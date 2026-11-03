// GET  /api/wa/pool   -> config + counters, merged for the admin screen
// POST /api/wa/pool   -> replace the number list (admin, needs x-wa-token)
//
// POST only ever writes configuration. Counters are ignored, because they live
// in a separate KV key that the click path owns: if the admin screen sent its
// own copy of the counters back, a click that happened while the page was open
// would be lost, and vice versa. `resetStats: true` is the only way to touch
// counters from here.
import {
  checkToken,
  json,
  loadConfig,
  loadStats,
  mergeStats,
  saveConfig,
  saveStats,
  type Env,
  type WaNumber,
} from "./_shared";

const MAX_NUMBERS = 50;

function clean(raw: unknown): WaNumber | null {
  const n = (raw || {}) as Partial<WaNumber>;
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
    weight: Math.min(100, Math.max(1, Number(n.weight) || 1)),
    // Anything other than an explicit true is "paused": a malformed body must
    // not silently enable a number the operator switched off.
    active: n.active === true,
    dailyCap: Math.min(100000, Math.max(0, Number(n.dailyCap) || 0)),
    createdAt: Math.max(0, Number(n.createdAt) || Date.now()),
  };
}

async function view(env: Env) {
  const pool = await loadConfig(env);
  if (!pool) return null;
  const stats = await loadStats(env);
  return {
    numbers: mergeStats(pool, stats),
    refs: stats.refs,
    updatedAt: Math.max(pool.updatedAt, stats.updatedAt),
  };
}

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const auth = checkToken(request, env);
  if (auth === "unset") {
    return json(
      { ok: false, error: "token_unset", message: "WA_ADMIN_TOKEN 未配置" },
      503,
    );
  }
  if (auth !== "ok") return json({ ok: false, error: "denied" }, 401);

  const pool = await view(env);
  if (!pool) {
    return json(
      { ok: false, error: "no_storage", message: "未绑定 WA_POOL KV" },
      503,
    );
  }
  return json({ ok: true, pool });
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const auth = checkToken(request, env);
  if (auth === "unset") {
    return json(
      { ok: false, error: "token_unset", message: "WA_ADMIN_TOKEN 未配置" },
      503,
    );
  }
  if (auth !== "ok") return json({ ok: false, error: "denied" }, 401);

  const existing = await loadConfig(env);
  if (!existing) {
    return json(
      { ok: false, error: "no_storage", message: "未绑定 WA_POOL KV" },
      503,
    );
  }

  let body: { numbers?: unknown; clearRefs?: unknown; resetStats?: unknown };
  try {
    body = (await request.json()) as {
      numbers?: unknown;
      clearRefs?: unknown;
      resetStats?: unknown;
    };
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!Array.isArray(body.numbers)) {
    return json({ ok: false, error: "bad_numbers" }, 400);
  }

  const numbers = body.numbers
    .slice(0, MAX_NUMBERS)
    .map(clean)
    .filter((n): n is WaNumber => Boolean(n));

  // Configuration write. Counters in the request body are deliberately dropped.
  // Read the counters first so the legacy migration has run and been persisted
  // before the old document is replaced.
  await loadStats(env);
  await saveConfig(env, { numbers, updatedAt: Date.now() });

  const wipe = body.resetStats === true || body.clearRefs === true;
  if (wipe) {
    await saveStats(env, { per: {}, refs: {}, updatedAt: Date.now() });
  }

  const pool = await view(env);
  return json({ ok: true, pool });
};
