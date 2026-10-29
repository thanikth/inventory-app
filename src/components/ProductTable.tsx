"use client";

import React from "react";
import type { Product, ProductStatus } from "@/types/product";
import styles from "@/styles/custom-table.module.scss";
import { LoaderCircle, Package, Pencil, TrendingUp } from "lucide-react";

interface ProductTableProps {
  products: Product[];
  isAdmin: boolean;
  onEdit?: (product: Product) => void;
  onStatusChange?: (product: Product, status: ProductStatus) => void;
  updatingProductCode?: string | null;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  isAdmin,
  onEdit,
  onStatusChange,
  updatingProductCode,
}) => {
  const isProductStatus = (value: string): value is ProductStatus =>
    value === "pending" || value === "active" || value === "inactive";

  const formatCurrency = (val?: number) => {
    if (val === undefined || isNaN(val)) return "-";
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(val);
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) {
      return <span className="stock-badge out-of-stock">สินค้าหมด</span>;
    } else if (stock <= 5) {
      return <span className="stock-badge low-stock">เหลือ {stock} ชิ้น</span>;
    }
    return <span className="stock-badge in-stock">{stock} ชิ้น</span>;
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>ไม่พบรายการสินค้า</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>รหัสสินค้า</th>
              <th>ชื่อสินค้า</th>
              {isAdmin && <th>ราคาต้นทุน (Cost)</th>}
              <th>ราคาขาย (Sale)</th>
              {isAdmin && <th>กำไรส่วนต่าง</th>}
              <th className="text-center">จำนวนที่มี (Stock)</th>
              {isAdmin && <th>สถานะ</th>}
              {isAdmin && <th>จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((item) => {
              const profit = (item.salePrice || 0) - (item.costPrice || 0);
              return (
                <tr key={item.code}>
                  <td className="font-mono font-medium text-slate-700">{item.code}</td>
                  <td className="font-medium text-slate-900">{item.name}</td>
                  {isAdmin && (
                    <td className="text-amber-600 font-semibold">
                      {formatCurrency(item.costPrice)}
                    </td>
                  )}
                  <td className="text-blue-600 font-bold">
                    {formatCurrency(item.salePrice)}
                  </td>
                  {isAdmin && (
                    <td>
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {formatCurrency(profit)}
                      </span>
                    </td>
                  )}
                  <td className="text-center">
                    {getStockBadge(item.stock)}
                  </td>
                  {isAdmin && (
                    <>
                      <td>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`สถานะสินค้า ${item.code}`}
                            value={item.status ?? "active"}
                            disabled={updatingProductCode === item.code}
                            onChange={(event) => {
                              const status = event.target.value;
                              if (isProductStatus(status)) {
                                onStatusChange?.(item, status);
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                          >
                            <option value="pending">รอตรวจสอบ</option>
                            <option value="active">พร้อมใช้งาน</option>
                            <option value="inactive">ปิดใช้งาน</option>
                          </select>
                          {updatingProductCode === item.code && (
                            <span
                              role="status"
                              aria-label="กำลังอัปเดตสถานะ"
                              className="inline-flex items-center gap-1 text-xs text-blue-600"
                            >
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              กำลังอัปเดต
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => onEdit?.(item)}
                          disabled={updatingProductCode === item.code}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          แก้ไข
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
