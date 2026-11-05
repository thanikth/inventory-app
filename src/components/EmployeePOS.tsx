"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  Barcode,
  Check,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import type { EmployeeSession } from "@/types/employee";
import type { Product } from "@/types/product";

interface EmployeePOSProps {
  employee: EmployeeSession;
  products: Product[];
  loading: boolean;
  isFallback: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Receipt {
  number: string;
  issuedAt: Date;
  employeeName: string;
  items: Array<{
    code: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  total: number;
}

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
  }).format(amount);

export const EmployeePOS: React.FC<EmployeePOSProps> = ({
  employee,
  products,
  loading,
  isFallback,
  onRefresh,
  onLogout,
}) => {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notice, setNotice] = useState("");
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [savingSale, setSavingSale] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isScannerOpen) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let scanTimeout: ReturnType<typeof setTimeout> | null = null;

    const startScanner = async () => {
      try {
        const Detector = (
          window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector;
        if (!Detector) {
          throw new Error(
            "เบราว์เซอร์นี้ไม่รองรับการสแกนบาร์โค้ดจากกล้อง กรุณาใช้ Chrome เวอร์ชันล่าสุด",
          );
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("ไม่สามารถเข้าถึงกล้องได้ กรุณาใช้ HTTPS และอนุญาตการใช้กล้อง");
        }

        const formats = [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "itf",
          "qr_code",
        ];
        const supportedFormats = Detector.getSupportedFormats
          ? await Detector.getSupportedFormats()
          : formats;
        const detector = new Detector({
          formats: formats.filter((format) => supportedFormats.includes(format)),
        });
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) throw new Error("ไม่พบพื้นที่แสดงภาพจากกล้อง");

        video.srcObject = stream;
        await video.play();

        const scanFrame = async () => {
          if (cancelled) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const results = await detector.detect(video);
              const barcode = results.find((result) => result.rawValue.trim());
              if (barcode) {
                setQuery(barcode.rawValue.trim());
                setNotice("");
                setIsScannerOpen(false);
                window.setTimeout(() => searchRef.current?.focus(), 0);
                return;
              }
            } catch {
              if (!cancelled) {
                setScannerError("อ่านบาร์โค้ดไม่สำเร็จ กรุณาลองจัดตำแหน่งสินค้าใหม่");
              }
              return;
            }
          }
          scanTimeout = setTimeout(() => void scanFrame(), 200);
        };

        void scanFrame();
      } catch (error) {
        if (!cancelled) {
          setScannerError(
            error instanceof Error ? error.message : "เปิดกล้องไม่สำเร็จ",
          );
        }
      }
    };

    setScannerError("");
    void startScanner();

    return () => {
      cancelled = true;
      if (scanTimeout !== null) clearTimeout(scanTimeout);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [isScannerOpen]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (!product.status || product.status === "active") && product.stock > 0,
      ),
    [products],
  );
  const filteredProducts = availableProducts.filter((product) => {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      !normalizedQuery ||
      product.code.toLowerCase().includes(normalizedQuery) ||
      product.name.toLowerCase().includes(normalizedQuery)
    );
  });
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce(
    (sum, item) => sum + item.product.salePrice * item.quantity,
    0,
  );
  const employeeName =
    employee.nickname || employee.firstName || employee.userId;

  const addProduct = (product: Product, closeModal = false) => {
    if (requestIdRef.current) return;
    setNotice("");
    const currentItem = cart.find(
      (item) => item.product.code === product.code,
    );
    if (currentItem && currentItem.quantity >= product.stock) {
      setNotice(`สินค้า ${product.code} มีในสต็อกไม่พอ`);
      return;
    }
    setCart(
      currentItem
        ? cart.map((item) =>
            item.product.code === product.code
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...cart, { product, quantity: 1 }],
    );
    setQuery("");
    if (closeModal) {
      setIsSaleModalOpen(false);
    } else {
      searchRef.current?.focus();
    }
  };

  const handleScan = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const scannedCode = query.trim().toLowerCase();
    if (!scannedCode) return;
    const product = availableProducts.find(
      (item) => item.code.trim().toLowerCase() === scannedCode,
    );
    if (!product) {
      setNotice(`ไม่พบรหัสสินค้า “${query.trim()}” หรือสินค้าหมด`);
      return;
    }
    addProduct(product);
  };

  const changeQuantity = (product: Product, change: number) => {
    if (requestIdRef.current) return;
    setNotice("");
    const currentItem = cart.find(
      (item) => item.product.code === product.code,
    );
    if (!currentItem) return;
    if (currentItem.quantity + change > product.stock) {
      setNotice(`สินค้า ${product.code} มีในสต็อกไม่พอ`);
      return;
    }
    setCart(
      cart
        .map((item) =>
          item.product.code === product.code
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const completeSale = async () => {
    if (savingSale || cart.length === 0) return;
    setSavingSale(true);
    setNotice("");
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "completeSale",
          data: {
            requestId: requestIdRef.current,
            employeeId: employee.userId,
            items: cart.map(({ product, quantity }) => ({
              code: product.code,
              quantity,
            })),
          },
        }),
      });
      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        if (response.status < 500 && result.status !== "success") {
          requestIdRef.current = null;
        }
        throw new Error(result.message || "บันทึกการขายไม่สำเร็จ กรุณาลองใหม่");
      }

      const sale = result.data;
      if (
        !sale ||
        typeof sale.number !== "string" ||
        typeof sale.issuedAt !== "string" ||
        !Array.isArray(sale.items) ||
        typeof sale.total !== "number"
      ) {
        throw new Error("บันทึกการขายแล้ว แต่ข้อมูลใบเสร็จไม่ถูกต้อง กรุณารีเฟรช");
      }

      setReceipt({
        number: sale.number,
        issuedAt: new Date(sale.issuedAt),
        employeeName: sale.employeeName || employeeName,
        items: sale.items,
        total: sale.total,
      });
      requestIdRef.current = null;
      setCart([]);
      setIsSaleModalOpen(false);
      void onRefresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/20">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">หน้าขายสินค้า</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              สวัสดี, {employeeName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "กำลังโหลด..." : "รีเฟรชสินค้า"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {isFallback && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            กำลังแสดงข้อมูลตัวอย่าง สินค้าในรายการอาจไม่ตรงกับสต็อกจริง
          </span>
          <button type="button" onClick={onRefresh} className="font-semibold underline">
            ลองเชื่อมต่ออีกครั้ง
          </button>
        </div>
      )}

      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            พร้อมให้บริการลูกค้า
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            เปิดหน้าคิดเงินเพื่อสแกนบาร์โค้ด ค้นหาสินค้า และจัดการรายการขาย
          </p>
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setIsSaleModalOpen(true);
            }}
            disabled={loading}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Barcode className="h-5 w-5" />
            {loading ? "กำลังโหลดสินค้า..." : "เลือกสินค้าเพื่อคิดเงิน"}
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
              สินค้าพร้อมขาย {availableProducts.length} รายการ
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
              {itemCount} ชิ้นในรายการ
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
              ยอด {formatCurrency(total)}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-slate-900">สรุปรายการขาย</h2>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {itemCount} ชิ้น
          </span>
        </div>

        {cart.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            <ArrowDown className="mx-auto mb-2 h-6 w-6" />
            ยังไม่มีสินค้าในรายการ กด “เลือกสินค้าเพื่อคิดเงิน” เพื่อเริ่มขาย
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto px-5">
            {cart.map(({ product, quantity }) => (
              <li key={product.code} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCurrency(product.salePrice)} / ชิ้น
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-800">
                    {formatCurrency(product.salePrice * quantity)}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-lg border border-slate-200">
                    <button
                      type="button"
                      aria-label={`ลดจำนวน ${product.name}`}
                      onClick={() => changeQuantity(product, -1)}
                      disabled={Boolean(requestIdRef.current)}
                      className="p-2 text-slate-500 hover:text-blue-700 disabled:opacity-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`เพิ่มจำนวน ${product.name}`}
                      onClick={() => changeQuantity(product, 1)}
                      disabled={Boolean(requestIdRef.current)}
                      className="p-2 text-slate-500 hover:text-blue-700 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`ลบ ${product.name} จากรายการขาย`}
                    disabled={Boolean(requestIdRef.current)}
                    onClick={() =>
                      setCart((current) =>
                        current.filter(
                          (item) => item.product.code !== product.code,
                        ),
                      )
                    }
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>จำนวน {itemCount} ชิ้น</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">ยอดรวมสุทธิ</span>
            <span className="text-2xl font-bold text-blue-700">
              {formatCurrency(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={completeSale}
            disabled={cart.length === 0 || savingSale}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingSale ? (
              "กำลังบันทึกการขาย..."
            ) : (
              <>
                <Printer className="h-4 w-4" />
                {requestIdRef.current
                  ? "ลองบันทึกการขายอีกครั้ง"
                  : "ยืนยันการขายและออกใบเสร็จ"}
              </>
            )}
          </button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCart([]);
                setNotice("");
              }}
              disabled={Boolean(requestIdRef.current)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-rose-600 disabled:opacity-50"
            >
              ล้างรายการ
            </button>
          )}
          <p className="mt-3 text-center text-xs text-slate-400">
            ยืนยันแล้วจะบันทึกลงชีต Sales และตัดสต็อกสินค้า
          </p>
        </div>
      </section>

      {isSaleModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-modal-title"
            className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl sm:rounded-3xl"
          >
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div>
                <h2 id="sale-modal-title" className="font-bold text-slate-900">
                  เลือกสินค้าเพื่อคิดเงิน
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  สแกนบาร์โค้ด หรือค้นหาชื่อและรหัสสินค้า
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaleModalOpen(false)}
                disabled={savingSale}
                aria-label="ปิดหน้าคิดเงิน"
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="overflow-y-auto p-3 sm:p-5">
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <Barcode className="h-5 w-5 shrink-0" />
                <span>
                  สแกนบาร์โค้ดแล้วกด Enter หรือพิมพ์รหัสสินค้าเพื่อเพิ่มลงรายการ
                </span>
              </div>

              <section>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <label className="relative block flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchRef}
                      autoFocus
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setNotice("");
                      }}
                      onKeyDown={handleScan}
                      disabled={Boolean(requestIdRef.current)}
                      placeholder="สแกนบาร์โค้ด หรือค้นหาชื่อ / รหัสสินค้า..."
                      aria-label="สแกนบาร์โค้ดหรือค้นหาสินค้า"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerError("");
                      setIsScannerOpen(true);
                    }}
                    disabled={Boolean(requestIdRef.current)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Barcode className="h-4 w-4" />
                    สแกนบาร์โค้ด
                  </button>
                </div>

                {notice && (
                  <p
                    role="status"
                    className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {notice}
                  </p>
                )}

                {loading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
                    กำลังโหลดสินค้า...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
                    <Package className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                    {query ? "ไม่พบสินค้าที่ค้นหา" : "ไม่มีสินค้าพร้อมขาย"}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((product) => (
                      <button
                        type="button"
                        key={product.code}
                        onClick={() => addProduct(product, true)}
                        disabled={Boolean(requestIdRef.current)}
                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {product.imageData ? (
                          <img
                            src={product.imageData}
                            alt=""
                            loading="lazy"
                            className="aspect-square w-full bg-slate-100 object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center bg-slate-100 text-slate-300">
                            <Package className="h-10 w-10" />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {product.name}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-slate-400">
                            {product.code}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="font-bold text-blue-700">
                              {formatCurrency(product.salePrice)}
                            </span>
                            <span className="text-xs text-slate-500">
                              เหลือ {product.stock}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}

      {isSaleModalOpen && isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="barcode-scanner-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="barcode-scanner-title"
                  className="font-bold text-slate-900"
                >
                  สแกนบาร์โค้ด
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  วางบาร์โค้ดให้อยู่ในกรอบกล้อง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                aria-label="ปิดกล้องสแกน"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-5">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-video w-full rounded-xl bg-slate-950 object-cover"
              />
              {scannerError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {scannerError}
                </p>
              ) : (
                <p className="mt-3 text-center text-sm text-slate-500">
                  เมื่ออ่านได้แล้ว รหัสจะถูกใส่ในช่องค้นหา
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                ปิดกล้อง
              </button>
            </div>
          </section>
        </div>
      )}

              {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 print:hidden">
              <div>
                <h2 id="receipt-title" className="font-bold text-slate-900">
                  ตรวจสอบใบเสร็จ
                </h2>
                <p className="text-xs text-slate-500">พร้อมสำหรับพิมพ์</p>
              </div>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                aria-label="ปิดใบเสร็จ"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div id="receipt-print" className="p-6">
              <div className="text-center">
                <Check className="mx-auto h-8 w-8 text-emerald-500 print:hidden" />
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  ใบเสร็จรับเงิน
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  เลขที่ {receipt.number}
                </p>
                <p className="text-xs text-slate-500">
                  {receipt.issuedAt.toLocaleString("th-TH")}
                </p>
                <p className="text-xs text-slate-500">
                  พนักงาน: {receipt.employeeName}
                </p>
              </div>
              <div className="my-5 border-t border-dashed border-slate-300" />
              <div className="space-y-3">
                {receipt.items.map((item) => (
                  <div key={item.code} className="flex justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="my-5 border-t border-dashed border-slate-300" />
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>ยอดรวมทั้งสิ้น</span>
                <span>{formatCurrency(receipt.total)}</span>
              </div>
              <p className="mt-6 text-center text-xs text-slate-500">
                ขอบคุณที่ใช้บริการ
              </p>
              <p className="mt-2 text-center text-[10px] text-slate-400 print:hidden">
                รายการขายนี้ถูกบันทึกลงระบบและตัดสต็อกแล้ว
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-4 print:hidden">
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                กลับไปแก้รายการ
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                พิมพ์ใบเสร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
