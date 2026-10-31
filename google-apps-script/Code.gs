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

      // ตรวจสอบข้อมูลจำเป็น: ชื่อ (ชื่อเล่นหรือชื่อจริง) และเบอร์โทรศัพท์
      if ((!emp.nickname && !emp.firstName) || !emp.phone) {
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

      const lastRow = sheet.getLastRow();

      // ถ้าไม่ได้ระบุ userId มา ให้สร้างให้อัตโนมัติ เช่น EMP001, EMP002
      const autoUserId = "EMP" + String(lastRow).padStart(3, "0");
      const finalUserId = emp.userId ? String(emp.userId).trim() : autoUserId;

      // ถ้าไม่ได้ระบุ password ให้ใช้ 4 ตัวท้ายของเบอร์โทร หรือค่าเริ่มต้น 1234
      const defaultPassword = emp.phone ? emp.phone.slice(-4) : "1234";
      const finalPassword = emp.password
        ? String(emp.password).trim()
        : defaultPassword;

      // บันทึกลง Sheet แถวใหม่ (คอลัมน์ A ถึง L)
      sheet.appendRow([
        finalUserId,
        finalPassword,
        emp.nickname || "",
        emp.firstName || "",
        emp.lastName || "",
        emp.address || "",
        emp.phone || "",
        emp.branch || "",
        emp.position || "",
        Number(emp.salary) || 0,
        emp.employmentType || "ประจำ",
        emp.status === undefined || emp.status === null || emp.status === ""
          ? true
          : isEmployeeActive(emp.status),
      ]);

      return createJsonResponse({
        status: "success",
        message: "เพิ่มข้อมูลพนักงานสำเร็จ",
        data: { userId: finalUserId },
      });
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

    return createJsonResponse({
      status: "error",
      message: "Action ไม่ถูกต้อง",
    });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
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
