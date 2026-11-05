"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type { Employee } from "@/types/employee";

export type NewEmployee = Pick<Employee, "nickname" | "firstName" | "phone"> &
  Partial<
    Pick<
      Employee,
      | "userId"
      | "password"
      | "lastName"
      | "address"
      | "branch"
      | "position"
      | "salary"
      | "employmentType"
      | "status"
    >
  >;

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: NewEmployee) => Promise<void>;
}

type FormValues = {
  userId: string;
  password: string;
  nickname: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  branch: string;
  position: string;
  salary: string;
  employmentType: string;
};

const INITIAL_VALUES: FormValues = {
  userId: "",
  password: "",
  nickname: "",
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  branch: "",
  position: "",
  salary: "",
  employmentType: "ประจำ",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(INITIAL_VALUES);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!values.nickname.trim() && !values.firstName.trim()) {
      setError("กรุณากรอกชื่อเล่นหรือชื่อจริง");
      return;
    }
    if (!values.phone.trim()) {
      setError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    const salary = values.salary === "" ? undefined : Number(values.salary);
    if (
      salary !== undefined &&
      (!Number.isFinite(salary) || salary < 0)
    ) {
      setError("กรุณากรอกเงินเดือนเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        userId: values.userId.trim() || undefined,
        password: values.password || undefined,
        nickname: values.nickname.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        branch: values.branch.trim(),
        position: values.position.trim(),
        salary,
        employmentType: values.employmentType,
        status: true,
      });
      setValues(INITIAL_VALUES);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกข้อมูลพนักงานไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="ปิดหน้าต่าง"
          className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="employee-form-title" className="text-lg font-bold text-slate-800">
          เพิ่มข้อมูลพนักงาน
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          ต้องกรอกชื่อเล่นหรือชื่อจริง และเบอร์โทรศัพท์
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              ชื่อเล่น
              <input
                value={values.nickname}
                onChange={(event) => updateField("nickname", event.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ชื่อจริง
              <input
                value={values.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              นามสกุล
              <input
                value={values.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              เบอร์โทรศัพท์ *
              <input
                type="tel"
                required
                value={values.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              รหัสผู้ใช้
              <input
                value={values.userId}
                onChange={(event) => updateField("userId", event.target.value)}
                placeholder="เว้นว่างเพื่อให้ระบบสร้าง"
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              รหัสผ่านเริ่มต้น
              <input
                type="text"
                value={values.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="เว้นว่างเพื่อใช้ 4 หลักท้ายเบอร์โทร"
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              สาขา
              <input
                value={values.branch}
                onChange={(event) => updateField("branch", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ตำแหน่ง
              <input
                value={values.position}
                onChange={(event) => updateField("position", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ประเภทการจ้าง
              <select
                value={values.employmentType}
                onChange={(event) =>
                  updateField("employmentType", event.target.value)
                }
                className={inputClass}
              >
                <option value="ประจำ">ประจำ</option>
                <option value="พาร์ทไทม์">พาร์ทไทม์</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              เงินเดือน
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.salary}
                onChange={(event) => updateField("salary", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            ที่อยู่
            <textarea
              rows={2}
              value={values.address}
              onChange={(event) => updateField("address", event.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <div role="alert" className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกพนักงาน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
