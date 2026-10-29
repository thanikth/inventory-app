export interface Product {
  code: string;
  name: string;
  costPrice?: number;
  salePrice: number;
  stock: number;
  status?: ProductStatus;
}

export type ProductStatus = "pending" | "active" | "inactive";

export type SheetResponse = {
  status: "success" | "error";
  data?: Product[];
  message?: string;
};
