"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Product, ProductStatus } from "@/types/product";
import type { EmployeeSession } from "@/types/employee";
import { ProductTable } from "@/components/ProductTable";
import { LoginForm } from "@/components/LoginForm";
import { ProductFormModal } from "@/components/ProductFormModal";
import {
  Shield,
  LogOut,
  RefreshCw,
  Search,
  Layers,
  Plus,
  CheckCircle2,
  X,
} from "lucide-react";

const FALLBACK_PRODUCTS: Product[] = [
  {
    code: "P001",
    name: "เสื้อยืด Premium Cotton",
    costPrice: 120,
    salePrice: 250,
    stock: 15,
    status: "active",
  },
  {
    code: "P002",
    name: "กางเกงยีนส์ Slim Fit",
    costPrice: 450,
    salePrice: 890,
    stock: 4,
    status: "active",
  },
  {
    code: "P003",
    name: "หมวกแก๊ป Minimal Cap",
    costPrice: 90,
    salePrice: 199,
    stock: 0,
    status: "active",
  },
  {
    code: "P004",
    name: "กระเป๋าผ้า Canvas Eco",
    costPrice: 65,
    salePrice: 150,
    stock: 32,
    status: "active",
  },
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [actionError, setActionError] = useState("");
  const [updatingProductCode, setUpdatingProductCode] = useState<string | null>(null);
  const [statusSaved, setStatusSaved] = useState(false);

  const isAdmin = employee?.employmentType?.trim().toLowerCase() === "admin";

  const fetchProducts = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();

      if (data && data.status === "success" && Array.isArray(data.data)) {
        setProducts(data.data);
        setIsFallback(false);
      } else {
        throw new Error("Invalid format");
      }
    } catch {
      setProducts(FALLBACK_PRODUCTS);
      setIsFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employee) void fetchProducts();
  }, [employee, fetchProducts]);

  if (!employee) {
    return <LoginForm onLogin={setEmployee} />;
  }

  const filteredProducts = products
    .filter((product) => {
      if (isAdmin) return true;
      return !product.status || product.status === "active";
    })
    .filter(
      (product) =>
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  const submitProductAction = async (
    action: "create" | "update",
    product: Product,
  ) => {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, product }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `บันทึกข้อมูลไม่สำเร็จ (${response.status})`);
    }

    if (result.status !== "success") {
      throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const saveProduct = async (product: Product) => {
    const action = editingProduct ? "update" : "create";
    await submitProductAction(action, product);
    setProducts((current) =>
      action === "create"
        ? [...current, product]
        : current.map((item) =>
            item.code === editingProduct?.code ? product : item,
          ),
    );
    setActionError("");
  };

  const updateProductStatus = async (product: Product, status: ProductStatus) => {
    if (updatingProductCode) return;
    setUpdatingProductCode(product.code);
    setActionError("");
    setStatusSaved(false);
    try {
      const updatedProduct = { ...product, status };
      await submitProductAction("update", updatedProduct);
      setProducts((current) =>
        current.map((item) =>
          item.code === product.code ? updatedProduct : item,
        ),
      );
      setActionError("");
      setStatusSaved(true);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ",
      );
    } finally {
      setUpdatingProductCode(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              ระบบคลังสินค้า (Inventory)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            เชื่อมต่อข้อมูล Google Sheets Web App
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg border border-violet-200">
                <Shield className="w-4 h-4" />
                Admin: {employee.nickname || employee.firstName || employee.userId}
              </span>
              <button
                onClick={() => setEmployee(null)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">
                {employee.nickname || employee.firstName || employee.userId}
              </span>
              <button
                onClick={() => setEmployee(null)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {isFallback && (
        <div className="my-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <span>
            ⚠️ ยังเชื่อมต่อ Google Sheets API ไม่ได้ (กำลังแสดง Mock Data) —
            อย่าลืมใส่ฟังก์ชัน doGet ใน Google Apps Script
          </span>
          <button
            onClick={fetchProducts}
            className="flex items-center gap-1 underline font-medium hover:text-amber-900"
          >
            <RefreshCw className="w-3 h-3" /> ลองใหม่
          </button>
        </div>
      )}

      <div className="my-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสสินค้า หรือชื่อสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setActionError("");
                setIsProductModalOpen(true);
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition self-end sm:self-auto"
            >
              <Plus className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              เพิ่มสินค้าใหม่
            </button>
          )}

          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition self-end sm:self-auto"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-blue-600" />
          <p className="text-sm">กำลังโหลดข้อมูลสินค้า...</p>
        </div>
      ) : (
        <>
          {isAdmin && (
            <p className="mb-3 text-xs text-slate-500">
              สินค้าที่เพิ่มใหม่จะมีสถานะ “รอตรวจสอบ”
              และจะแสดงหน้าแรกเมื่อเปลี่ยนเป็น “พร้อมใช้งาน”
            </p>
          )}
          <ProductTable
            products={filteredProducts}
            isAdmin={isAdmin}
            updatingProductCode={updatingProductCode}
            onEdit={(product) => {
              setEditingProduct(product);
              setActionError("");
              setIsProductModalOpen(true);
            }}
            onStatusChange={updateProductStatus}
          />
        </>
      )}

      {isAdmin && (
        <ProductFormModal
          isOpen={isProductModalOpen}
          product={editingProduct}
          products={products}
          onClose={() => setIsProductModalOpen(false)}
          onSave={saveProduct}
        />
      )}

      {statusSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-saved-title"
            className="relative w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setStatusSaved(false)}
              aria-label="ปิดหน้าต่าง"
              className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2
              id="status-saved-title"
              className="mt-3 text-lg font-bold text-slate-800"
            >
              บันทึกข้อมูลสำเร็จ
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              อัปเดตสถานะสินค้าเรียบร้อยแล้ว
            </p>
            <button
              type="button"
              onClick={() => setStatusSaved(false)}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
