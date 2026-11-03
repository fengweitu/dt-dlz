// GET /api/wa/next?ref=&p=&vid=&prefer=&peek=
// Returns the number a visitor should be handed to.
//
//   peek=1  ask which number this visitor would get, WITHOUT counting a click.
//           Used to warm the number up while the page loads, so the actual
//           click can navigate instantly. Page views must not inflate the
//           "how many people did this agent receive" number.
//   normal  counts one click. Used right before navigating to wa.me.
//
// Only counters are written here. Configuration (including the enabled flag) is
// never touched by this endpoint, so a click can no longer undo a change made
// in the admin screen.
import {
  json,
  loadConfig,
  loadStats,
  pickNumber,
  record,
  saveStats,
  type Env,
} from "./_shared";

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);

  const pool = await loadConfig(env);
  if (!pool) return json({ ok: false, error: "no_storage" }, 503);

  const stats = await loadStats(env);

  // Cloudflare sets cf.country from the request IP. Absent locally.
  const country = String(
    (request as unknown as { cf?: { country?: string } }).cf?.country || "",
  ).toUpperCase();

  const { number, overflow } = pickNumber(
    pool,
    stats,
    country,
    url.searchParams.get("prefer") || "",
  );

  // Every number is paused. Do not hand out a disabled number: answer honestly
  // and let the client ask the visitor to retry.
  if (!number) return json({ ok: false, error: "no_active" }, 503);

  const peek = url.searchParams.get("peek") === "1";
  if (!peek) {
    record(
      stats,
      number,
      url.searchParams.get("vid") || "",
      url.searchParams.get("ref") || "",
    );
    await saveStats(env, stats);
  }

  return json({
    ok: true,
    id: number.id,
    name: number.name,
    phone: number.phone,
    overflow,
  });
};
