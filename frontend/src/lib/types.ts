export interface Variant {
  id: number;
  product_id: number;
  label: string;
  price: number;
  stock: number;
  active: number;
}
export interface Product {
  id: number;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  max_price: number;
  old_price: number;
  stock: number;
  image: string;
  gallery: string[];
  tag: string;
  description: string;
  source_url: string;
  source_checked_on: string;
  active: number;
  variants: Variant[];
}
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}
export interface CartItem {
  id: number;
  variant_id: number | null;
  qty: number;
}
export interface LineItem extends CartItem {
  name: string;
  price: number;
  image: string;
  variant_label: string;
}
export interface Quote {
  items: LineItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
}
export interface Address {
  id?: number;
  name: string;
  phone: string;
  detail: string;
}
export interface Order extends Quote {
  id: string;
  address: Address;
  status: string;
  created: number;
  tracking: string;
  payment: string;
  email?: string;
}
export interface Coupon {
  code: string;
  percent: number;
  minimum: number;
  active: number;
}
