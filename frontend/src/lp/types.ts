// Shared shapes for the WhatsApp number pool.
// Configuration lives in Cloudflare KV under `wa-pool`, counters under
// `wa-stats`; both are served by functions/api/wa/* and edited in /wh-admin.
// The admin screen sees the two merged into WaNumber.

export interface WaNumber {
  id: string;
  name: string;
  /** Digits only, with country code, e.g. 8615190068041. */
  phone: string;
  /** ["ALL"] or ISO-3166 alpha-2 codes such as ["US", "CA"]. */
  countries: string[];
  /** Relative share of traffic among eligible numbers. */
  weight: number;
  active: boolean;
  /** 0 = unlimited. Counts chats handed off per day. */
  dailyCap: number;
  clicks: number;
  /** Distinct visitor ids, capped when written. */
  uv: string[];
  dayKey: string;
  dayCount: number;
  lastClickAt: number;
  createdAt: number;
}

export interface WaPool {
  numbers: WaNumber[];
  /** Ref code -> handoff count, so the admin can see which page or ad converts. */
  refs: Record<string, number>;
  updatedAt: number;
}

export interface AssignResult {
  ok: boolean;
  id: string;
  name: string;
  phone: string;
  source: "cloud" | "static";
  /** True when every eligible number was already over its daily cap. */
  overflow?: boolean;
}

export const emptyPool = (): WaPool => ({
  numbers: [],
  refs: {},
  updatedAt: 0,
});

export function newNumber(
  name: string,
  phone: string,
  patch: Partial<WaNumber> = {},
): WaNumber {
  return {
    id: "n" + Math.random().toString(36).slice(2, 9),
    name,
    phone,
    countries: ["ALL"],
    weight: 1,
    active: true,
    dailyCap: 0,
    clicks: 0,
    uv: [],
    dayKey: "",
    dayCount: 0,
    lastClickAt: 0,
    createdAt: Date.now(),
    ...patch,
  };
}
