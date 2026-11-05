"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, ImagePlus, X } from "lucide-react";
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
  imageData: string;
};

const EMPTY_FORM: ProductFormValues = {
  code: "",
  name: "",
  costPrice: "",
  salePrice: "",
  stock: "",
  imageData: "",
};

const MAX_IMAGE_DATA_URL_LENGTH = 45_000;

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
            imageData: product.imageData ?? "",
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
        imageData: values.imageData,
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

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("รูปภาพต้องมีขนาดไม่เกิน 10 MB");
      return;
    }

    setError("");
    try {
      const source = URL.createObjectURL(file);
      try {
        const image = new window.Image();
        if (typeof image.decode === "function") {
          image.src = source;
          await image.decode();
        } else {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("ไม่สามารถอ่านรูปภาพได้"));
            image.src = source;
          });
        }

        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("ไม่สามารถประมวลผลรูปภาพได้");

        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let imageData = "";
        for (let attempt = 0; attempt < 8; attempt += 1) {
          for (const quality of [0.82, 0.68, 0.54, 0.4]) {
            imageData = canvas.toDataURL("image/jpeg", quality);
            if (imageData.length <= MAX_IMAGE_DATA_URL_LENGTH) break;
          }
          if (imageData.length <= MAX_IMAGE_DATA_URL_LENGTH) break;
          canvas.width = Math.max(1, Math.round(canvas.width * 0.8));
          canvas.height = Math.max(1, Math.round(canvas.height * 0.8));
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        if (imageData.length > MAX_IMAGE_DATA_URL_LENGTH) {
          throw new Error("รูปภาพมีขนาดใหญ่เกินไปแม้บีบอัดแล้ว");
        }
        updateField("imageData", imageData);
      } finally {
        URL.revokeObjectURL(source);
      }
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : "ไม่สามารถอ่านรูปภาพได้",
      );
    }
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
          <div>
            <label className="block text-sm font-medium text-slate-700">
              รูปสินค้า
              <span className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4" />
                เลือกรูป (ระบบย่อและบีบอัดให้อัตโนมัติ)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </span>
            </label>
            {values.imageData && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={values.imageData}
                  alt="ตัวอย่างรูปสินค้า"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => updateField("imageData", "")}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  ลบรูป
                </button>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              รูปจะถูกบีบอัดให้เหมาะกับข้อจำกัดของ Google Sheets
            </p>
          </div>

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
