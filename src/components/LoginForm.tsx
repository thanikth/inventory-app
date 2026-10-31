"use client";

import React, { useState } from "react";
import { AlertCircle, KeyRound, UserRound } from "lucide-react";
import type { EmployeeSession } from "@/types/employee";

interface LoginResponse {
  status?: string;
  message?: string;
  user?: EmployeeSession;
}

interface PasswordChangeResponse {
  status?: string;
  message?: string;
}

interface LoginFormProps {
  onLogin: (employee: EmployeeSession) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingEmployee, setPendingEmployee] =
    useState<EmployeeSession | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "loginEmployee",
          data: { userId: userId.trim(), password },
        }),
      });
      const result = (await response.json()) as LoginResponse;

      if (!response.ok || result.status !== "success" || !result.user) {
        throw new Error(
          result.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล",
        );
      }

      if (result.user.mustChangePassword) {
        setPendingEmployee(result.user);
        setMustChangePassword(true);
      } else {
        onLogin(result.user);
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!pendingEmployee) {
      setError("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "changeEmployeePassword",
          data: {
            userId: userId.trim(),
            currentPassword: password,
            newPassword,
          },
        }),
      });
      const result = (await response.json()) as PasswordChangeResponse;

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }

      onLogin({ ...pendingEmployee, mustChangePassword: false });
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mustChangePassword ? "ตั้งรหัสผ่านใหม่" : "เข้าสู่ระบบ"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mustChangePassword
              ? "เพื่อความปลอดภัย กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน"
              : "ระบบคลังสินค้า กรุณาเข้าสู่ระบบด้วยบัญชีพนักงาน"}
          </p>
        </div>

        {mustChangePassword ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
              </span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                ยืนยันรหัสผ่านใหม่
              </span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "กำลังบันทึกรหัสผ่าน..." : "บันทึกรหัสผ่านใหม่"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                รหัสผู้ใช้
              </span>
              <span className="relative block">
                <UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  placeholder="ระบุรหัสผู้ใช้"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                รหัสผ่าน
              </span>
              <span className="relative block">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="ระบุรหัสผ่าน"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
