// WhatsApp handoff.
//
// Every CTA on the landing page goes through here:
//   1. build a pre-filled message (product + ref code, never a price),
//   2. ask our own server which number to use (pool, geo, caps),
//   3. navigate the current tab to wa.me.
//
// Step 2 is what makes the pool work: the ad, the landing page and the link a
// visitor keeps all stay the same while the number behind them can change.
import type { Product } from "../lib/types";
import type { WaNumber, WaPool, AssignResult } from "./types";
import { mgRange, packageLabel, slugify } from "./data";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const VID_KEY = "tideora-vid";
const PREFER_KEY = "tideora-wa-number";
const REF_KEY = "tideora-wa-ref";

/** Stable per-browser id, used for unique-visitor counting and stickiness. */
export function visitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v =
        "v" +
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36).slice(-4);
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

/** One ref code per tab, so retries do not inflate the stats. */
export function refCode(prefix: string): string {
  const key = REF_KEY + "-" + prefix;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
  } catch {
    /* private mode */
  }
  const code = prefix + "-" + randomCode();
  try {
    sessionStorage.setItem(key, code);
  } catch {
    /* ignore */
  }
  return code;
}

/**
 * No price in the message on purpose: the landing page never shows one, so the
 * first thing the agent sends back is the price for the exact package asked for.
 */
export function productMessage(p: Product, ref: string): string {
  return [
    "Hi TIDEORA — I'd like the price and availability for:",
    "",
    `• ${p.name} (${mgRange(p)}, ${packageLabel(p)})`,
    `Ref: ${ref}`,
    "",
    "Please send the price list, the shipping cost to my country, and the batch COA.",
  ].join("\n");
}

export function generalMessage(ref: string): string {
  return [
    "Hi TIDEORA — I'd like your price list and availability.",
    "",
    `Ref: ${ref}`,
    "",
    "Please include shipping to my country and the batch COA for the products I ask about.",
  ].join("\n");
}

export function waUrl(phone: string, text: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

async function fetchJson(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let staticPool: WaPool | null = null;

/**
 * Fallback pool, used only when /api/wa/next is unreachable.
 *
 * The single source is /api/wa/public, which is filtered server-side to enabled
 * numbers. A JSON snapshot bundled at build time used to sit behind it, but that
 * file is frozen: it kept advertising numbers the operator had paused since the
 * last deploy, which is exactly how a disabled number kept getting handed out.
 * There is no file fallback any more — "no enabled number" is answered honestly.
 */
async function loadStaticPool(): Promise<WaPool | null> {
  if (staticPool) return staticPool;

  const live = (await fetchJson("/api/wa/public", 3000)) as {
    ok?: boolean;
    numbers?: WaNumber[];
  } | null;
  if (live && live.ok && Array.isArray(live.numbers) && live.numbers.length) {
    staticPool = { numbers: live.numbers, refs: {}, updatedAt: 0 };
    return staticPool;
  }
  return null;
}

function pickLocal(pool: WaPool, prefer: string): WaNumber | null {
  const live = pool.numbers.filter((n) => n.active);
  // Never fall back to a paused number: the operator paused it for a reason.
  if (!live.length) return null;
  const sticky = live.find((n) => n.id === prefer);
  if (sticky) return sticky;
  const weight = (n: WaNumber) => Math.max(1, n.weight || 1);
  const total = live.reduce((sum, n) => sum + weight(n), 0);
  let roll = Math.random() * total;
  for (const n of live) {
    roll -= weight(n);
    if (roll <= 0) return n;
  }
  return live[0];
}

/**
 * Resolve which number this visitor should talk to.
 * Never throws. When no enabled number exists it returns ok:false and an empty
 * phone: the caller must show a retry card rather than a number the operator
 * has paused.
 */
export async function assign(opts: {
  ref: string;
  product: string;
}): Promise<AssignResult> {
  const prefer = (() => {
    try {
      return localStorage.getItem(PREFER_KEY) || "";
    } catch {
      return "";
    }
  })();

  const qs = new URLSearchParams({
    ref: opts.ref,
    p: opts.product,
    vid: visitorId(),
  });
  if (prefer) qs.set("prefer", prefer);

  const cloud = (await fetchJson("/api/wa/next?" + qs.toString(), 2500)) as
    | {
        ok?: boolean;
        id?: string;
        name?: string;
        phone?: string;
        overflow?: boolean;
      }
    | null;

  if (cloud && cloud.ok && cloud.phone && cloud.id) {
    try {
      localStorage.setItem(PREFER_KEY, cloud.id);
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      id: cloud.id,
      name: cloud.name || "",
      phone: cloud.phone,
      source: "cloud",
      overflow: cloud.overflow,
    };
  }

  const pool = await loadStaticPool();
  const number = pool ? pickLocal(pool, prefer) : null;
  // No enabled number anywhere: report it instead of inventing one.
  if (!number) {
    return { ok: false, id: "", name: "", phone: "", source: "static" };
  }
  return {
    ok: true,
    id: number.id,
    name: number.name,
    phone: number.phone,
    source: "static",
  };
}

/** Meta Pixel hook. No-op until a pixel id is configured in index.html. */
export function track(event: string, params: Record<string, unknown> = {}) {
  try {
    window.fbq?.("track", event, params);
  } catch {
    /* ignore */
  }
}
