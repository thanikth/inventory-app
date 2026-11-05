function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const type =
      e && e.parameter && e.parameter.type ? e.parameter.type : "products";

    // 1. ดึงข้อมูลพนักงาน
    if (type === "employees") {
      const sheet = ss.getSheetByName("Employees");
      if (!sheet)
        return createJsonResponse({
          status: "error",
          message: missingEmployeeSheetMessage(ss),
        });

      const data = sheet.getDataRange().getValues();
      const rows = data.slice(1); // ข้าม Header แถว 1

      const employees = rows
        .map((row, index) => ({
          id: index + 1,
          userId: String(row[0] || "").trim(),
          password: String(row[1] || "").trim(), // รหัสผ่าน (Admin ดู/จัดการได้)
          nickname: String(row[2] || "").trim(),
          firstName: String(row[3] || "").trim(),
          lastName: String(row[4] || "").trim(),
          address: String(row[5] || "").trim(),
          phone: String(row[6] || "").trim(),
          branch: String(row[7] || "").trim(),
          position: String(row[8] || "").trim(),
          salary: Number(row[9]) || 0,
          employmentType: String(row[10] || "").trim(),
          status: isEmployeeActive(row[11]),
        }))
        .filter(
          (emp) =>
            emp.userId !== "" || emp.firstName !== "" || emp.nickname !== "",
        );

      return createJsonResponse({ status: "success", data: employees });

      // 2. ดึงข้อมูลสินค้า
    } else {
      let sheet = ss.getSheetByName("Products");
      if (!sheet) sheet = ss.getSheets()[0];

      const data = sheet.getDataRange().getValues();
      const rows = data.slice(1);
      const products = rows
        .map((row) => ({
          code: String(row[0] || "").trim(),
          name: String(row[1] || "").trim(),
          costPrice: Number(row[2]) || 0,
          salePrice: Number(row[3]) || 0,
          stock: Number(row[4]) || 0,
          status: normalizeProductStatus(row[5]),
          imageData: String(row[6] || ""),
        }))
        .filter((item) => item.code !== "");

      return createJsonResponse({ status: "success", data: products });
    }
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // กรณีที่ 1: เพิ่มพนักงานใหม่
    if (postData.action === "addEmployee") {
      const emp = postData.data;
      if (!emp || typeof emp !== "object") {
        return createJsonResponse({
          status: "error",
          message: "ข้อมูลพนักงานไม่ถูกต้อง",
        });
      }

      // ตรวจสอบข้อมูลจำเป็น: ชื่อ (ชื่อเล่นหรือชื่อจริง) และเบอร์โทรศัพท์
      const nickname = String(emp.nickname || "").trim();
      const firstName = String(emp.firstName || "").trim();
      const phone = String(emp.phone || "").trim();
      if ((!nickname && !firstName) || !phone) {
        return createJsonResponse({
          status: "error",
          message: "กรุณากรอกชื่อและเบอร์โทรศัพท์ (ข้อมูลจำเป็น)",
        });
      }

      const sheet = ss.getSheetByName("Employees");
      if (!sheet)
        return createJsonResponse({
          status: "error",
          message: missingEmployeeSheetMessage(ss),
        });

      const employeeLock = LockService.getScriptLock();
      employeeLock.waitLock(10000);
      try {
        const employeeRows = sheet.getDataRange().getValues().slice(1);
        const requestedUserId = String(emp.userId || "").trim();
        const existingUserIds = employeeRows.map((row) =>
          String(row[0] || "").trim().toLowerCase(),
        );
        let finalUserId = requestedUserId;

        if (!finalUserId) {
          const largestEmployeeNumber = employeeRows.reduce((largest, row) => {
            const match = String(row[0] || "").trim().match(/^EMP(\d+)$/i);
            return match ? Math.max(largest, Number(match[1])) : largest;
          }, 0);
          finalUserId = "EMP" + String(largestEmployeeNumber + 1).padStart(3, "0");
        }

        if (existingUserIds.includes(finalUserId.toLowerCase())) {
          throw new Error("รหัสผู้ใช้นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
        }

        // ถ้าไม่ได้ระบุ password ให้ใช้ 4 ตัวท้ายของเบอร์โทร
        const defaultPassword = phone.slice(-4);
        const requestedPassword = String(emp.password || "").trim();
        const finalPassword = requestedPassword
          ? requestedPassword
          : defaultPassword;
        const salary = emp.salary === "" || emp.salary === undefined
          ? 0
          : Number(emp.salary);
        const employmentType = String(emp.employmentType || "ประจำ").trim();
        if (!isFinite(salary) || salary < 0) {
          throw new Error("เงินเดือนไม่ถูกต้อง");
        }
        if (employmentType !== "ประจำ" && employmentType !== "พาร์ทไทม์") {
          throw new Error("ประเภทการจ้างไม่ถูกต้อง");
        }

        // บันทึกลง Sheet พร้อมกำหนดให้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก
        sheet.appendRow([
          finalUserId,
          finalPassword,
          nickname,
          firstName,
          String(emp.lastName || "").trim(),
          String(emp.address || "").trim(),
          phone,
          String(emp.branch || "").trim(),
          String(emp.position || "").trim(),
          salary,
          employmentType,
          emp.status === undefined || emp.status === null || emp.status === ""
            ? true
            : isEmployeeActive(emp.status),
          true,
        ]);

        return createJsonResponse({
          status: "success",
          message: "เพิ่มข้อมูลพนักงานสำเร็จ",
          data: { userId: finalUserId },
        });
      } finally {
        employeeLock.releaseLock();
      }
    }

    // กรณีที่ 2: ระบบเข้าสู่ระบบ (Login) สำหรับพนักงาน
    if (postData.action === "loginEmployee") {
      const { userId, password } = postData.data;
      const sheet = ss.getSheetByName("Employees");
      if (!sheet)
        return createJsonResponse({
          status: "error",
          message: missingEmployeeSheetMessage(ss),
        });

      const data = sheet.getDataRange().getValues().slice(1);
      const employees = data.filter((row) =>
        row.some((value) => String(value || "").trim() !== ""),
      );
      const submittedUserId = String(userId || "").trim();
      const submittedPassword = String(password || "").trim();

      if (
        employees.length === 0 &&
        submittedUserId === "admin" &&
        submittedPassword === "1234"
      ) {
        createDefaultAdmin(sheet);
      }

      const currentEmployees = sheet.getDataRange().getValues().slice(1);
      const user = currentEmployees.find(
        (row) =>
          String(row[0] || "").trim() === submittedUserId &&
          String(row[1] || "").trim() === submittedPassword &&
          isEmployeeActive(row[11]),
      );

      if (user) {
        return createJsonResponse({
          status: "success",
          message: "เข้าสู่ระบบสำเร็จ",
          user: {
            userId: user[0],
            nickname: user[2],
            firstName: user[3],
            position: user[8],
            branch: user[7],
            employmentType: String(user[10] || "").trim(),
            mustChangePassword:
              String(user[12] || "").trim().toLowerCase() === "true",
          },
        });
      } else {
        return createJsonResponse({
          status: "error",
          message: "userId หรือ password ไม่ถูกต้อง",
        });
      }
    }

    if (postData.action === "changeEmployeePassword") {
      const { userId, currentPassword, newPassword } = postData.data || {};
      const submittedUserId = String(userId || "").trim();
      const submittedCurrentPassword = String(currentPassword || "").trim();
      const submittedNewPassword = String(newPassword || "").trim();

      if (submittedNewPassword.length < 8) {
        return createJsonResponse({
          status: "error",
          message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
        });
      }
      if (submittedNewPassword === submittedCurrentPassword) {
        return createJsonResponse({
          status: "error",
          message: "กรุณาตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับรหัสผ่านเดิม",
        });
      }

      const sheet = ss.getSheetByName("Employees");
      if (!sheet)
        return createJsonResponse({
          status: "error",
          message: missingEmployeeSheetMessage(ss),
        });

      const rows = sheet.getDataRange().getValues();
      const rowIndex = rows.findIndex(
        (row, index) =>
          index > 0 &&
          String(row[0] || "").trim() === submittedUserId &&
          String(row[1] || "").trim() === submittedCurrentPassword &&
          isEmployeeActive(row[11]) &&
          String(row[12] || "").trim().toLowerCase() === "true",
      );

      if (rowIndex === -1) {
        return createJsonResponse({
          status: "error",
          message: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาเข้าสู่ระบบใหม่",
        });
      }

      sheet.getRange(rowIndex + 1, 2).setValue(submittedNewPassword);
      sheet.getRange(rowIndex + 1, 13).setValue(false);
      return createJsonResponse({
        status: "success",
        message: "เปลี่ยนรหัสผ่านสำเร็จ",
      });
    }

    if (postData.action === "completeSale") {
      return completeSale(ss, postData.data);
    }

    if (postData.action === "create" || postData.action === "update") {
      const product = postData.product;
      if (!product || typeof product !== "object") {
        return createJsonResponse({
          status: "error",
          message: "ข้อมูลสินค้าไม่ถูกต้อง",
        });
      }

      const code = String(product.code || "").trim();
      const name = String(product.name || "").trim();
      const costPrice = Number(product.costPrice);
      const salePrice = Number(product.salePrice);
      const stock = Number(product.stock);
      const status = normalizeProductStatus(product.status);
      const imageData =
        product.imageData === undefined || product.imageData === null
          ? null
          : String(product.imageData);

      if (
        !code ||
        !name ||
        !isFinite(costPrice) ||
        costPrice < 0 ||
        !isFinite(salePrice) ||
        salePrice < 0 ||
        !isFinite(stock) ||
        stock < 0 ||
        Math.floor(stock) !== stock
      ) {
        return createJsonResponse({
          status: "error",
          message: "กรุณาตรวจสอบข้อมูลสินค้าและตัวเลขอีกครั้ง",
        });
      }
      if (
        imageData !== null &&
        imageData !== "" &&
        (imageData.length > 45000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData))
      ) {
        return createJsonResponse({
          status: "error",
          message: "รูปภาพไม่ถูกต้องหรือมีขนาดเกินข้อจำกัดของ Google Sheets",
        });
      }

      let sheet = ss.getSheetByName("Products");
      if (!sheet) sheet = ss.getSheets()[0];

      const productLock = LockService.getScriptLock();
      productLock.waitLock(10000);
      try {
        const rows = sheet.getDataRange().getValues();
        const matchingRow = rows.findIndex(
          (row, index) =>
            index > 0 &&
            String(row[0] || "").trim().toLowerCase() === code.toLowerCase(),
        );

        if (postData.action === "create" && matchingRow !== -1) {
          throw new Error("รหัสสินค้านี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
        }
        if (postData.action === "update" && matchingRow === -1) {
          throw new Error("ไม่พบสินค้าที่ต้องการแก้ไข");
        }

        if (!sheet.getRange(1, 6).getValue()) {
          sheet.getRange(1, 6).setValue("สถานะ");
        }
        if (!sheet.getRange(1, 7).getValue()) {
          sheet.getRange(1, 7).setValue("รูปภาพ");
        }

        if (postData.action === "create") {
          sheet.appendRow([
            code,
            name,
            costPrice,
            salePrice,
            stock,
            status,
            imageData || "",
          ]);
        } else {
          const sheetRow = matchingRow + 1;
          const previousImage = String(rows[matchingRow][6] || "");
          sheet.getRange(sheetRow, 1, 1, 7).setValues([[
            code,
            name,
            costPrice,
            salePrice,
            stock,
            status,
            imageData === null ? previousImage : imageData,
          ]]);
        }
      } finally {
        productLock.releaseLock();
      }

      return createJsonResponse({
        status: "success",
        message:
          postData.action === "create"
            ? "เพิ่มสินค้าเรียบร้อย"
            : "บันทึกข้อมูลสินค้าเรียบร้อย",
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Action ไม่ถูกต้อง",
    });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function completeSale(ss, data) {
  if (!data || typeof data !== "object") {
    return createJsonResponse({
      status: "error",
      message: "ข้อมูลการขายไม่ถูกต้อง",
    });
  }

  const requestId = String(data.requestId || "").trim();
  const employeeId = String(data.employeeId || "").trim();
  const requestedItems = data.items;
  if (!/^[A-Za-z0-9-]{10,80}$/.test(requestId)) {
    return createJsonResponse({
      status: "error",
      message: "รหัสคำขอขายไม่ถูกต้อง กรุณาลองใหม่",
    });
  }
  if (!employeeId || !Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 100) {
    return createJsonResponse({
      status: "error",
      message: "กรุณาระบุพนักงานและรายการสินค้าให้ถูกต้อง",
    });
  }

  const productSheet =
    ss.getSheetByName("Products") || ss.getSheets()[0];
  const employeeSheet = ss.getSheetByName("Employees");
  if (!employeeSheet) {
    return createJsonResponse({
      status: "error",
      message: missingEmployeeSheetMessage(ss),
    });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let salesSheet = ss.getSheetByName("Sales");
    if (!salesSheet) salesSheet = ss.insertSheet("Sales");
    const headers = [
      "รหัสคำขอ",
      "เลขที่ใบเสร็จ",
      "วันที่ขาย",
      "รหัสพนักงาน",
      "ชื่อพนักงาน",
      "รหัสสินค้า",
      "ชื่อสินค้า",
      "จำนวน",
      "ราคาต่อหน่วย",
      "รวมรายการ",
    ];
    if (!salesSheet.getRange(1, 1).getValue()) {
      salesSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const salesRows = salesSheet.getDataRange().getValues();
    const priorRows = salesRows.slice(1).filter(
      (row) => String(row[0] || "").trim() === requestId,
    );
    if (priorRows.length > 0) {
      return createJsonResponse({
        status: "success",
        message: "รายการขายบันทึกแล้ว",
        data: saleReceiptFromRows(priorRows),
      });
    }

    const employeeRows = employeeSheet.getDataRange().getValues();
    const employeeRow = employeeRows.find(
      (row, index) =>
        index > 0 &&
        String(row[0] || "").trim().toLowerCase() === employeeId.toLowerCase() &&
        isEmployeeActive(row[11]),
    );
    if (!employeeRow) {
      return createJsonResponse({
        status: "error",
        message: "ไม่พบพนักงานที่ใช้งานได้ กรุณาเข้าสู่ระบบใหม่",
      });
    }
    const employeeName =
      String(employeeRow[2] || "").trim() ||
      [employeeRow[3], employeeRow[4]]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ") ||
      employeeId;

    const productRows = productSheet.getDataRange().getValues();
    const productIndexes = new Map();
    productRows.forEach((row, index) => {
      if (index === 0) return;
      const code = String(row[0] || "").trim().toLowerCase();
      if (!code) return;
      if (productIndexes.has(code)) {
        productIndexes.set(code, null);
      } else {
        productIndexes.set(code, index);
      }
    });

    const quantities = new Map();
    requestedItems.forEach((item) => {
      const code = String(item && item.code || "").trim();
      const quantity = Number(item && item.quantity);
      if (!code || !isFinite(quantity) || quantity <= 0 || Math.floor(quantity) !== quantity) {
        throw new Error("จำนวนสินค้าที่ขายไม่ถูกต้อง");
      }
      const key = code.toLowerCase();
      quantities.set(key, (quantities.get(key) || 0) + quantity);
    });

    const items = [];
    const stockChanges = [];
    quantities.forEach((quantity, code) => {
      const productIndex = productIndexes.get(code);
      if (productIndex === undefined || productIndex === null) {
        throw new Error(`ไม่พบรหัสสินค้า ${code} หรือมีรหัสซ้ำในชีต`);
      }

      const row = productRows[productIndex];
      const productCode = String(row[0] || "").trim();
      const productName = String(row[1] || "").trim();
      const unitPrice = Number(row[3]);
      const stock = Number(row[4]);
      const productStatus = normalizeProductStatus(row[5]);
      if (productStatus !== "active") {
        throw new Error(`สินค้า ${productCode} ไม่พร้อมจำหน่าย`);
      }
      if (!isFinite(unitPrice) || unitPrice < 0 || !isFinite(stock) || stock < 0 || Math.floor(stock) !== stock) {
        throw new Error(`ข้อมูลราคา/สต็อกของสินค้า ${productCode} ไม่ถูกต้อง`);
      }
      if (quantity > stock) {
        throw new Error(`สินค้า ${productCode} มีสต็อกไม่พอ (คงเหลือ ${stock})`);
      }

      const lineTotal = unitPrice * quantity;
      items.push({
        code: productCode,
        name: productName,
        quantity: quantity,
        unitPrice: unitPrice,
        lineTotal: lineTotal,
      });
      stockChanges.push({
        rowNumber: productIndex + 1,
        oldStock: stock,
        newStock: stock - quantity,
      });
    });

    const issuedAt = new Date();
    const saleId =
      "R" +
      Utilities.formatDate(
        issuedAt,
        Session.getScriptTimeZone(),
        "yyyyMMddHHmmss",
      ) +
      "-" +
      Utilities.getUuid().slice(0, 8).toUpperCase();
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const saleRows = items.map((item) => [
      requestId,
      saleId,
      issuedAt.toISOString(),
      employeeId,
      employeeName,
      item.code,
      item.name,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
    ]);

    const updatedStocks = [];
    try {
      stockChanges.forEach((change) => {
        updatedStocks.push(change);
        productSheet.getRange(change.rowNumber, 5).setValue(change.newStock);
      });

      const firstSaleRow = salesSheet.getLastRow() + 1;
      const requiredLastRow = firstSaleRow + saleRows.length - 1;
      if (requiredLastRow > salesSheet.getMaxRows()) {
        salesSheet.insertRowsAfter(
          salesSheet.getMaxRows(),
          requiredLastRow - salesSheet.getMaxRows(),
        );
      }
      salesSheet
        .getRange(firstSaleRow, 1, saleRows.length, headers.length)
        .setValues(saleRows);
    } catch (error) {
      const rollbackErrors = [];
      updatedStocks.reverse().forEach((change) => {
        try {
          productSheet.getRange(change.rowNumber, 5).setValue(change.oldStock);
        } catch (rollbackError) {
          rollbackErrors.push(String(rollbackError));
        }
      });
      Logger.log(
        "Sale write failed: " +
          String(error) +
          (rollbackErrors.length
            ? "; stock rollback failed: " + rollbackErrors.join("; ")
            : ""),
      );
      throw new Error(
        rollbackErrors.length
          ? "บันทึกการขายไม่สำเร็จและคืนสต็อกได้ไม่ครบ กรุณาตรวจสอบชีต Products และ Sales"
          : "บันทึกการขายไม่สำเร็จ ระบบได้คืนสต็อกแล้ว กรุณาลองใหม่",
      );
    }

    return createJsonResponse({
      status: "success",
      message: "บันทึกการขายและตัดสต็อกเรียบร้อย",
      data: {
        number: saleId,
        issuedAt: issuedAt.toISOString(),
        employeeName: employeeName,
        items: items,
        total: total,
      },
    });
  } finally {
    lock.releaseLock();
  }
}

function saleReceiptFromRows(rows) {
  const firstRow = rows[0];
  const items = rows.map((row) => ({
    code: String(row[5] || ""),
    name: String(row[6] || ""),
    quantity: Number(row[7]) || 0,
    unitPrice: Number(row[8]) || 0,
    lineTotal: Number(row[9]) || 0,
  }));
  return {
    number: String(firstRow[1] || ""),
    issuedAt: String(firstRow[2] || ""),
    employeeName: String(firstRow[4] || ""),
    items: items,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

function normalizeProductStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "pending" || value === "inactive" ? value : "active";
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function isEmployeeActive(status) {
  return status === true || String(status || "").trim().toLowerCase() === "true";
}

function missingEmployeeSheetMessage(ss) {
  const sheetNames = ss.getSheets().map((sheet) => sheet.getName());
  return `ไม่พบแท็บ Employees ใน Spreadsheet ที่เชื่อมอยู่ แท็บที่พบ: ${JSON.stringify(sheetNames)} ตรวจสอบว่า Apps Script ผูกกับ Spreadsheet ที่ถูกต้อง และชื่อแท็บตรงทุกตัวอักษร`;
}

function createDefaultAdmin(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const employees = sheet.getDataRange().getValues().slice(1).filter((row) =>
      row.some((value) => String(value || "").trim() !== ""),
    );
    if (employees.length === 0) {
      if (!sheet.getRange(1, 13).getValue()) {
        sheet.getRange(1, 13).setValue("ต้องเปลี่ยนรหัสผ่าน");
      }
      sheet.appendRow([
        "admin",
        "1234",
        "Admin",
        "Admin",
        "",
        "",
        "",
        "",
        "Admin",
        0,
        "admin",
        true,
        true,
      ]);
    }
  } finally {
    lock.releaseLock();
  }
}
