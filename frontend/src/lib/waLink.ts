// Site-wide WhatsApp router.
//
// Every WhatsApp link on the storefront is written with one hard-coded number
// (lib/api.ts). This module intercepts those links at click time and swaps in
// the number the pool assigns, so that:
//   - the admin can see how many people each agent actually received,
//   - a number can be paused or replaced without editing the site,
//   - the agent still gets the same pre-filled message.
//
// The server is the only source of truth. An earlier version cached the
// assigned number in sessionStorage for ten minutes and navigated straight to
// it, which meant a number paused in the admin screen kept being handed out to
// everyone who already had the site open. The cache now only remembers *which*
// agent this visitor talked to (for stickiness) — never the phone number.
//
// If every number is paused the visitor gets a "please retry" card instead of a
// dead link, and never a number the operator switched off.
import { visitorId } from "../lp/wa";

const REF_KEY = "tideora-wa-site-ref";
const PREFER_KEY = "tideora-wa-prefer";
const TIMEOUT_MS = 3000;

type Target = { id: string; phone: string };

let installed = false;

function readPrefer(): string {
  try {
    return sessionStorage.getItem(PREFER_KEY) || "";
  } catch {
    return "";
  }
}

function writePrefer(id: string) {
  try {
    sessionStorage.setItem(PREFER_KEY, id);
  } catch {
    /* private mode */
  }
}

/** One ref code per tab, so the refs panel does not explode. */
function siteRef(): string {
  try {
    const saved = sessionStorage.getItem(REF_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const code = "SITE-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  try {
    sessionStorage.setItem(REF_KEY, code);
  } catch {
    /* ignore */
  }
  return code;
}

function nextUrl(ref: string, where: string, peek = false): string {
  const qs = new URLSearchParams({
    ref,
    p: where.slice(0, 40),
    vid: visitorId(),
  });
  const prefer = readPrefer();
  if (prefer) qs.set("prefer", prefer);
  if (peek) qs.set("peek", "1");
  return "/api/wa/next?" + qs.toString();
}

function whereAmI(): string {
  return window.location.hash.replace(/^#/, "") || window.location.pathname;
}

type Resolved =
  | { status: "ok"; target: Target }
  | { status: "empty" }
  | { status: "error" };

/** Ask the server which agent this visitor should get. Counts one click. */
async function resolve(ref: string, where: string): Promise<Resolved> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(nextUrl(ref, where), {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      id?: string;
      phone?: string;
      error?: string;
    } | null;
    if (data && data.error === "no_active") return { status: "empty" };
    if (!res.ok || !data || !data.ok || !data.phone) return { status: "error" };
    const phone = String(data.phone).replace(/\D/g, "");
    if (!phone) return { status: "error" };
    if (data.id) writePrefer(data.id);
    return { status: "ok", target: { id: data.id || "cloud", phone } };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}

function swapPhone(href: string, phone: string): string {
  try {
    const url = new URL(href, window.location.href);
    if (!/(^|\.)wa\.me$/.test(url.hostname)) return href;
    const text = url.searchParams.get("text") || "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  } catch {
    return href;
  }
}

/**
 * Second tier: the live list of numbers that are still enabled, straight from
 * the server. Frozen build-time snapshots are not used here on purpose — they
 * can still mention a number the operator has since paused.
 */
async function publicPhone(): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/wa/public", {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      numbers?: Array<{ phone?: string; weight?: number; active?: boolean }>;
    };
    const live = (data?.numbers || []).filter(
      (n) => n && n.phone && n.active !== false,
    );
    if (!live.length) return null;
    const total = live.reduce((s, n) => s + Math.max(1, n.weight || 1), 0);
    let roll = Math.random() * total;
    for (const n of live) {
      roll -= Math.max(1, n.weight || 1);
      if (roll <= 0) return String(n.phone).replace(/\D/g, "");
    }
    return String(live[0].phone).replace(/\D/g, "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Which agent this visitor would reach right now. Display only — not counted. */
export type WaPeek = { id: string; name: string; phone: string };

export async function peekWaTarget(): Promise<WaPeek | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(nextUrl(siteRef(), whereAmI(), true), {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      id?: string;
      name?: string;
      phone?: string;
    } | null;
    if (res.ok && data && data.ok && data.phone) {
      const phone = String(data.phone).replace(/\D/g, "");
      if (phone) return { id: data.id || "", name: data.name || "", phone };
    }
  } catch {
    /* fall through to the public list */
  } finally {
    clearTimeout(timer);
  }

  // Second try: the enabled list. Same source the click path falls back to, so
  // the label still matches where the button will actually go.
  const phone = await publicPhone();
  return phone ? { id: "", name: "", phone } : null;
}

/**
 * Re-point a wa.me link at the assigned number, keeping its message.
 * Returns null when no enabled number exists, so the caller can show a retry
 * card instead of sending the visitor to a number the operator paused.
 */
export async function routeWaUrl(href: string): Promise<string | null> {
  try {
    const u = new URL(href, window.location.href);
    if (!/(^|\.)wa\.me$/.test(u.hostname)) return href;
  } catch {
    return href;
  }

  const first = await resolve(siteRef(), whereAmI());
  if (first.status === "ok") return swapPhone(href, first.target.phone);

  const fallback = await publicPhone();
  if (fallback) return swapPhone(href, fallback);

  return null;
}

/** Inline card shown when every agent number is paused or the API is down. */
function showNoAgent() {
  if (document.getElementById("wa-noagent")) return;
  const wrap = document.createElement("div");
  wrap.id = "wa-noagent";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;background:rgba(12,26,20,.55);" +
    "display:flex;align-items:center;justify-content:center;padding:20px;" +
    "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;";
  wrap.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;' +
    'padding:22px 20px;box-shadow:0 24px 60px rgba(0,0,0,.28);text-align:center;">' +
    '<h3 style="margin:0 0 8px;font-size:17px;color:#132a20;">客服正在接入</h3>' +
    '<p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#5b6b62;">' +
    "Our team is connecting a new WhatsApp line. Please try again in a moment." +
    "</p>" +
    '<button type="button" data-act="retry" style="width:100%;border:0;border-radius:10px;' +
    "background:#128c5a;color:#fff;font-size:14px;font-weight:600;padding:12px;cursor:pointer;" +
    '">再试一次</button>' +
    '<button type="button" data-act="close" style="margin-top:10px;width:100%;border:0;' +
    'background:transparent;color:#6b7b72;font-size:12.5px;padding:6px;cursor:pointer;">' +
    "关闭</button></div>";
  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    if (el === wrap) wrap.remove();
    const act = el.getAttribute?.("data-act");
    if (act === "close") wrap.remove();
    if (act === "retry") {
      wrap.remove();
      void openWhatsApp(document.querySelector('a[href*="wa.me"]')?.getAttribute("href") || "");
    }
  });
}

/** Resolve, then navigate. Never navigates to a paused number. */
async function openWhatsApp(href: string) {
  const url = await routeWaUrl(href);
  if (!url) {
    showNoAgent();
    return;
  }
  window.location.assign(url);
}

/** Capture-phase click delegate: covers every CTA on the site, including new ones. */
export function installWaRouter() {
  if (installed) return;
  installed = true;

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const el = event.target as Element | null;
      const a = el?.closest?.('a[href*="wa.me"]') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.href;
      const wantsNewTab = a.target === "_blank";
      // Stop the browser from opening the hard-coded number while we ask the
      // server. This has to happen synchronously, before the first await.
      event.preventDefault();

      if (wantsNewTab) {
        // Open the tab now, while the click is still "live": browsers block a
        // window.open() that happens after an await, and a blocked popup looks
        // exactly like a wrong number to the visitor.
        const tab = window.open("about:blank", "_blank");
        void routeWaUrl(href).then((url) => {
          if (!url) {
            try {
              tab?.close();
            } catch {
              /* ignore */
            }
            showNoAgent();
            return;
          }
          if (tab) tab.location.replace(url);
          else window.location.assign(url);
        });
        return;
      }

      void routeWaUrl(href).then((url) => {
        if (!url) {
          showNoAgent();
          return;
        }
        window.location.assign(url);
      });
    },
    true,
  );
}
