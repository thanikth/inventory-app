function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const values = sheet.getDataRange().getValues();
    const products = values.slice(1).map(row => ({
      code: String(row[0] || "").trim(),
      name: String(row[1] || "").trim(),
      costPrice: Number(row[2]) || 0,
      salePrice: Number(row[3]) || 0,
      stock: Number(row[4]) || 0,
      status: normalizeStatus(row[5])
    })).filter(product => product.code !== "");

    return jsonResponse({ status: "success", data: products });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(event.postData.contents);
    const action = String(payload.action || "");
    const product = normalizeProduct(payload.product);
    if (action !== "create" && action !== "update") {
      throw new Error("ไม่พบคำสั่งที่รองรับ");
    }

    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 6).getValues()
      : [];
    const matchingRow = rows.findIndex(row =>
      String(row[0] || "").trim().toLowerCase() === product.code.toLowerCase()
    );

    if (action === "create" && matchingRow !== -1) {
      throw new Error("รหัสสินค้านี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
    }
    if (action === "update" && matchingRow === -1) {
      throw new Error("ไม่พบสินค้าที่ต้องการแก้ไข");
    }

    if (sheet.getLastColumn() < 6 || !sheet.getRange(1, 6).getValue()) {
      sheet.getRange(1, 6).setValue("สถานะ");
    }

    const rowValues = [
      product.code,
      product.name,
      product.costPrice,
      product.salePrice,
      product.stock,
      product.status
    ];
    if (action === "create") {
      sheet.appendRow(rowValues);
    } else {
      sheet.getRange(matchingRow + 2, 1, 1, rowValues.length).setValues([rowValues]);
    }

    return jsonResponse({ status: "success", data: product });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function normalizeProduct(value) {
  if (!value || typeof value !== "object") {
    throw new Error("ข้อมูลสินค้าไม่ถูกต้อง");
  }

  const code = String(value.code || "").trim();
  const name = String(value.name || "").trim();
  const costPrice = Number(value.costPrice);
  const salePrice = Number(value.salePrice);
  const stock = Number(value.stock);
  const requestedStatus = String(value.status || "pending").trim().toLowerCase();
  if (!["pending", "active", "inactive"].includes(requestedStatus)) {
    throw new Error("สถานะสินค้าไม่ถูกต้อง");
  }
  const status = requestedStatus;

  if (!code || !name) {
    throw new Error("กรุณาระบุรหัสสินค้าและชื่อสินค้า");
  }
  if (
    value.costPrice === "" ||
    value.costPrice === null ||
    value.salePrice === "" ||
    value.salePrice === null ||
    value.stock === "" ||
    value.stock === null ||
    !isFinite(costPrice) ||
    !isFinite(salePrice) ||
    !isFinite(stock) ||
    costPrice < 0 ||
    salePrice < 0 ||
    stock < 0 ||
    Math.floor(stock) !== stock
  ) {
    throw new Error("ราคาหรือจำนวนสินค้าไม่ถูกต้อง");
  }

  return { code, name, costPrice, salePrice, stock, status };
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status || status === "active" || status === "พร้อมใช้งาน") return "active";
  if (status === "pending" || status === "รอตรวจสอบ") return "pending";
  return "inactive";
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
