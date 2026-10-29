"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type { Product } from "@/types/product";

interface ProductFormModalProps {
  isOpen: boolean;
  product: Product | null;
  products: Product[];
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

type ProductFormValues = {
  code: string;
  name: string;
  costPrice: string;
  salePrice: string;
  stock: string;
};

const EMPTY_FORM: ProductFormValues = {
  code: "",
  name: "",
  costPrice: "",
  salePrice: "",
  stock: "",
};

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  products,
  onClose,
  onSave,
}) => {
  const [values, setValues] = useState<ProductFormValues>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(
      product
        ? {
            code: product.code,
            name: product.name,
            costPrice: String(product.costPrice ?? ""),
            salePrice: String(product.salePrice),
            stock: String(product.stock),
          }
        : EMPTY_FORM,
    );
    setError("");
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const code = values.code.trim();
    const duplicate = products.some(
      (item) =>
        item.code.trim().toLowerCase() === code.toLowerCase() &&
        item.code !== product?.code,
    );
    if (duplicate) {
      setError("รหัสสินค้านี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
      return;
    }

    const costPrice = Number(values.costPrice);
    const salePrice = Number(values.salePrice);
    const stock = Number(values.stock);
    if (
      !code ||
      !values.name.trim() ||
      values.costPrice === "" ||
      values.salePrice === "" ||
      values.stock === "" ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(salePrice) ||
      !Number.isInteger(stock) ||
      costPrice < 0 ||
      salePrice < 0 ||
      stock < 0
    ) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน และใช้ตัวเลขที่ไม่ติดลบ");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        code,
        name: values.name.trim(),
        costPrice,
        salePrice,
        stock,
        status: product?.status ?? "pending",
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ProductFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="relative w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
          className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="product-form-title" className="text-lg font-bold text-slate-800">
          {product ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          กรอกข้อมูลให้ครบทุกช่อง ราคาสามารถเป็น 0 ได้
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            รหัสสินค้า *
            <input
              required
              value={values.code}
              onChange={(event) => updateField("code", event.target.value)}
              disabled={Boolean(product)}
              className={inputClass}
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            ชื่อสินค้า *
            <input
              required
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              ราคาต้นทุน *
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={values.costPrice}
                onChange={(event) => updateField("costPrice", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              ราคาขาย *
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={values.salePrice}
                onChange={(event) => updateField("salePrice", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            จำนวนที่มี *
            <input
              type="number"
              required
              min="0"
              step="1"
              value={values.stock}
              onChange={(event) => updateField("stock", event.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <div role="alert" className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
