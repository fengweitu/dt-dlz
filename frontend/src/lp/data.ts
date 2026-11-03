// Data helpers for the ad landing page. Deliberately independent of
// lib/store.tsx: the landing page has no router, no account and no cart.
import catalog from "../data/catalog.json";
import type { Product, Variant } from "../lib/types";

const products: Product[] = (
  catalog as unknown as Array<Omit<Product, "max_price" | "active">>
).map((p) => ({
  ...p,
  max_price: Math.max(p.price, ...(p.variants || []).map((v) => v.price)),
  active: 1,
}));

export function allProducts(): Product[] {
  return products;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function orderable(p: Product): Variant[] {
  return [...(p.variants || [])]
    .filter((v) => v.active !== 0)
    .sort((a, b) => a.price - b.price);
}

/** "5mg – 60mg", or "10mg" when every package is the same size. */
export function mgRange(p: Product): string {
  const mgs = orderable(p)
    .map((v) => {
      const m = v.label.match(/(\d+(?:\.\d+)?)\s*mg/i);
      if (m) return Number(m[1]);
      // Some catalogue labels carry only a code, e.g. "RT10" or "BB20".
      const tail = v.label.match(/(\d+(?:\.\d+)?)\s*$/);
      return tail ? Number(tail[1]) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (!mgs.length) return "per package";
  const min = mgs[0];
  const max = mgs[mgs.length - 1];
  return min === max ? min + "mg" : min + "mg – " + max + "mg";
}

export function packageLabel(p: Product): string {
  const n = orderable(p).length;
  return n + (n === 1 ? " package" : " packages");
}

export const CATEGORIES = [
  { key: "GLP Series", label: "GLP series", blurb: "Semaglutide, Tirzepatide, Retatrutide" },
  { key: "Single Peptides", label: "Single peptides", blurb: "BPC-157, TB-500, Ipamorelin" },
  { key: "Peptide Blends", label: "Peptide blends", blurb: "Pre-combined, ready to research" },
] as const;

export function byCategory(key: string): Product[] {
  return key === "All" ? products : products.filter((p) => p.category === key);
}

/** A representative product image for a category tile. */
export function categoryImage(key: string): string {
  const p = products.find((x) => x.category === key);
  return p ? p.image : products[0].image;
}

export function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
