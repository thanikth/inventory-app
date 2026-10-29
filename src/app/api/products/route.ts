import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getSheetEndpoint = () => {
  const endpoint = process.env.NEXT_PUBLIC_SHEET_API_URL;
  if (!endpoint) {
    throw new Error("ยังไม่ได้ตั้งค่า Google Sheets API");
  }
  return endpoint;
};

const forwardResponse = async (response: Response) => {
  const responseText = await response.text();
  let result: { status?: string; message?: string; data?: unknown };
  try {
    result = JSON.parse(responseText);
  } catch {
    const isHtml =
      response.headers.get("content-type")?.includes("text/html") ||
      /^\s*<!doctype html|^\s*<html/i.test(responseText);
    const message = isHtml
      ? "Google Apps Script ส่งหน้า HTML กลับมาแทน JSON ตรวจว่า Deploy เป็น Web app เวอร์ชันล่าสุด, Execute as: Me และ Who has access: Anyone"
      : `Google Apps Script ส่งข้อมูลที่ไม่ใช่ JSON กลับมา (HTTP ${response.status})`;
    return NextResponse.json(
      { status: "error", message },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        status: "error",
        message: result.message || `Google Sheets API ตอบกลับ ${response.status}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(result, {
    status: result.status === "success" ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
};

export async function GET() {
  try {
    const response = await fetch(getSheetEndpoint(), {
      cache: "no-store",
      redirect: "follow",
    });
    return await forwardResponse(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อ Google Sheets API";
    return NextResponse.json(
      { status: "error", message },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(getSheetEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      cache: "no-store",
      redirect: "follow",
    });
    return await forwardResponse(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อ Google Sheets API";
    return NextResponse.json(
      { status: "error", message },
      { status: 502 },
    );
  }
}
