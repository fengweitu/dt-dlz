// Shared helpers for the WhatsApp number pool API (Cloudflare Pages Functions).
// Files under functions/ that do not export onRequest* are not routed, so this
// module is only ever imported.
//
// Storage is deliberately split across two KV keys:
//
//   wa-pool   configuration only (numbers, enabled flag, weight, countries, cap)
//   wa-stats  counters only (clicks, unique visitors, refs)
//
// The first version kept both in one document, which meant every click did
// load -> mutate -> save on the whole pool. KV is eventually consistent, so a
// click that read the pool a moment earlier would write its stale copy back and
// silently re-enable a number the operator had just paused. Separating the keys
// makes a click unable to touch configuration at all.

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  WA_POOL?: KVLike;
  WA_ADMIN_TOKEN?: string;
}

/** Configuration of one agent number. No counters here. */
export interface WaNumber {
  id: string;
  name: string;
  phone: string;
  countries: string[];
  weight: number;
  active: boolean;
  dailyCap: number;
  createdAt: number;
}

/** Counters for one agent number. Keyed by number id. */
export interface WaCounters {
  clicks: number;
  uv: string[];
  dayKey: string;
  dayCount: number;
  lastClickAt: number;
}

/** What the admin UI sees: configuration joined with counters. */
export type WaNumberView = WaNumber & WaCounters;

export interface WaPool {
  numbers: WaNumber[];
  updatedAt: number;
}

export interface WaStats {
  per: Record<string, WaCounters>;
  refs: Record<string, number>;
  updatedAt: number;
}

const POOL_KEY = "wa-pool";
const STATS_KEY = "wa-stats";

export const todayKey = () => new Date().toISOString().slice(0, 10);

export const emptyCounters = (): WaCounters => ({
  clicks: 0,
  uv: [],
  dayKey: "",
  dayCount: 0,
  lastClickAt: 0,
});

export function json(data: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
    },
  });
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Config only. Counters that older documents carry inline are dropped here. */
function toNumber(raw: unknown): WaNumber | null {
  const n = (raw || {}) as Partial<WaNumber> & { clicks?: unknown };
  const phone = String(n.phone || "").replace(/\D/g, "");
  if (phone.length < 7 || phone.length > 15) return null;
  const countries = Array.isArray(n.countries)
    ? n.countries
        .map((c) => String(c).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))
        .filter(Boolean)
    : ["ALL"];
  return {
    id: String(n.id || "n" + Math.random().toString(36).slice(2, 9)).slice(0, 24),
    name: String(n.name || "Support").slice(0, 60),
    phone,
    countries: countries.length ? countries : ["ALL"],
    weight: Math.min(100, Math.max(1, num(n.weight, 1) || 1)),
    active: n.active !== false,
    dailyCap: Math.min(100000, Math.max(0, num(n.dailyCap, 0))),
    createdAt: Math.max(0, num(n.createdAt, Date.now())) || Date.now(),
  };
}

export async function loadConfig(env: Env): Promise<WaPool | null> {
  if (!env.WA_POOL) return null;
  const raw = await env.WA_POOL.get(POOL_KEY);
  if (!raw) return { numbers: [], updatedAt: 0 };
  try {
    const parsed = JSON.parse(raw) as { numbers?: unknown[]; updatedAt?: number };
    const numbers = Array.isArray(parsed.numbers)
      ? parsed.numbers.map(toNumber).filter((n): n is WaNumber => Boolean(n))
      : [];
    return { numbers, updatedAt: num(parsed.updatedAt) };
  } catch {
    return { numbers: [], updatedAt: 0 };
  }
}

export async function saveConfig(env: Env, pool: WaPool): Promise<void> {
  if (!env.WA_POOL) throw new Error("no_storage");
  await env.WA_POOL.put(POOL_KEY, JSON.stringify(pool));
}

/**
 * Counters live in their own key. The very first read after this change still
 * finds counters embedded in the old pool document, so nothing is lost in the
 * migration.
 */
export async function loadStats(env: Env): Promise<WaStats> {
  const empty: WaStats = { per: {}, refs: {}, updatedAt: 0 };
  if (!env.WA_POOL) return empty;

  const raw = await env.WA_POOL.get(STATS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WaStats>;
      return {
        per: parsed.per && typeof parsed.per === "object" ? parsed.per : {},
        refs: parsed.refs && typeof parsed.refs === "object" ? parsed.refs : {},
        updatedAt: num(parsed.updatedAt),
      };
    } catch {
      return empty;
    }
  }

  // Migration path: lift counters out of the legacy single-document pool.
  const legacyRaw = await env.WA_POOL.get(POOL_KEY);
  if (!legacyRaw) return empty;
  try {
    const legacy = JSON.parse(legacyRaw) as {
      numbers?: Array<Record<string, unknown>>;
      refs?: Record<string, number>;
    };
    const per: Record<string, WaCounters> = {};
    for (const n of legacy.numbers || []) {
      const id = String(n.id || "");
      if (!id) continue;
      const clicks = num(n.clicks);
      const uv = Array.isArray(n.uv) ? n.uv.map((v) => String(v).slice(0, 40)) : [];
      if (!clicks && !uv.length) continue;
      per[id] = {
        clicks,
        uv,
        dayKey: String(n.dayKey || "").slice(0, 10),
        dayCount: num(n.dayCount),
        lastClickAt: num(n.lastClickAt),
      };
    }
    const migrated: WaStats = {
      per,
      refs: legacy.refs && typeof legacy.refs === "object" ? legacy.refs : {},
      updatedAt: num((legacy as { updatedAt?: number }).updatedAt),
    };
    // Persist immediately. Otherwise the next configuration write replaces the
    // legacy document and these counters are gone for good.
    if (Object.keys(per).length || Object.keys(migrated.refs).length) {
      await saveStats(env, migrated);
    }
    return migrated;
  } catch {
    return empty;
  }
}

export async function saveStats(env: Env, stats: WaStats): Promise<void> {
  if (!env.WA_POOL) throw new Error("no_storage");
  await env.WA_POOL.put(STATS_KEY, JSON.stringify(stats));
}

/** Configuration joined with counters, for the admin screen only. */
export function mergeStats(pool: WaPool, stats: WaStats): WaNumberView[] {
  return pool.numbers.map((n) => ({ ...n, ...(stats.per[n.id] || emptyCounters()) }));
}

/** "ok" | "unset" (no token configured) | "denied" */
export function checkToken(request: Request, env: Env): string {
  if (!env.WA_ADMIN_TOKEN) return "unset";
  const given =
    request.headers.get("x-wa-token") ||
    new URL(request.url).searchParams.get("token") ||
    "";
  if (given.length !== env.WA_ADMIN_TOKEN.length) return "denied";
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ env.WA_ADMIN_TOKEN.charCodeAt(i);
  }
  return diff === 0 ? "ok" : "denied";
}

function overCap(n: WaNumber, stats: WaStats): boolean {
  if (!n.dailyCap) return false;
  const c = stats.per[n.id];
  const used = c && c.dayKey === todayKey() ? c.dayCount || 0 : 0;
  return used >= n.dailyCap;
}

/**
 * Order of preference:
 *   1. numbers enabled for this country (or ALL),
 *   2. drop paused numbers, then numbers over their daily cap,
 *   3. keep the visitor on the number they already talked to,
 *   4. otherwise weighted random.
 *
 * A paused number is NEVER returned. If the operator has paused every number we
 * return null and the caller answers `no_active`: handing a visitor to an agent
 * the operator deliberately switched off is worse than asking them to retry.
 *
 * Running over a daily cap is different — that only means the agent is busy, so
 * we still return one, flagged as overflow, because losing the lead is worse.
 */
export function pickNumber(
  pool: WaPool,
  stats: WaStats,
  country: string,
  preferId: string,
): { number: WaNumber | null; overflow: boolean } {
  const live = pool.numbers.filter((n) => n.active);
  if (!live.length) return { number: null, overflow: false };

  const geo = live.filter((n) => {
    const list = n.countries && n.countries.length ? n.countries : ["ALL"];
    return list.includes("ALL") || list.includes(country);
  });
  const scope = geo.length ? geo : live;
  const usable = scope.filter((n) => !overCap(n, stats));
  const list = usable.length ? usable : scope;
  const overflow = usable.length === 0;

  const sticky = preferId ? list.find((n) => n.id === preferId) : undefined;
  if (sticky) return { number: sticky, overflow };

  const total = list.reduce((sum, n) => sum + Math.max(1, n.weight || 1), 0);
  let roll = Math.random() * total;
  for (const n of list) {
    roll -= Math.max(1, n.weight || 1);
    if (roll <= 0) return { number: n, overflow };
  }
  return { number: list[0], overflow };
}

/** Count one handoff. Touches counters only, never configuration. */
export function record(stats: WaStats, n: WaNumber, vid: string, ref: string): void {
  const today = todayKey();
  const c = stats.per[n.id] || emptyCounters();
  c.clicks = (c.clicks || 0) + 1;
  c.lastClickAt = Date.now();
  if (c.dayKey !== today) {
    c.dayKey = today;
    c.dayCount = 0;
  }
  c.dayCount = (c.dayCount || 0) + 1;
  if (vid && !c.uv.includes(vid)) {
    c.uv.push(vid);
    // Keep KV values bounded; the count that matters is the length.
    if (c.uv.length > 2000) c.uv = c.uv.slice(-2000);
  }
  stats.per[n.id] = c;

  if (ref) {
    const key = String(ref).slice(0, 40);
    stats.refs[key] = (stats.refs[key] || 0) + 1;
    const entries = Object.entries(stats.refs);
    if (entries.length > 400) {
      const kept = entries.sort((a, b) => b[1] - a[1]).slice(0, 200);
      stats.refs = Object.fromEntries(kept);
    }
  }
  stats.updatedAt = Date.now();
}
