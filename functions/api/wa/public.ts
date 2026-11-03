// GET /api/wa/public -> the numbers that are currently allowed to receive
// traffic, without any statistics.
//
// This is the fallback for clients that could not reach /api/wa/next (offline,
// slow network, ad blocker). It exists so a number the operator paused can
// never be handed out again: the list is filtered here, server-side, instead of
// relying on a static file that was frozen at build time.
//
// Nothing sensitive is exposed: these numbers are already public, they are the
// destination of every wa.me link on the site.
import { json, loadConfig, type Env, type WaNumber } from "./_shared";

const publicView = (n: WaNumber) => ({
  id: n.id,
  name: n.name,
  phone: n.phone,
  countries: n.countries,
  weight: n.weight,
  active: true,
});

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const pool = await loadConfig(context.env);
  if (!pool) {
    return json({ ok: false, error: "no_storage" }, 503);
  }
  const numbers = pool.numbers.filter((n) => n.active).map(publicView);
  // Short cache: a paused number stops being offered within a minute, and the
  // endpoint stays cheap when a page load fans out to several clients.
  return json(
    { ok: true, numbers, updatedAt: pool.updatedAt },
    200,
    "public, max-age=30",
  );
};
