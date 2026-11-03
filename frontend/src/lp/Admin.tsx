import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  ExternalLink,
  Save,
  LogOut,
  RefreshCw,
} from "lucide-react";
import type { WaNumber, WaPool } from "./types";
import { emptyPool, newNumber } from "./types";
import "./lp.css";

const TOKEN_KEY = "tideora-wa-token";

export function isAdminPath(path: string): boolean {
  return path === "/wh-admin" || path === "/wh-admin/";
}

const todayKey = () => new Date().toISOString().slice(0, 10);

// A static preview (127.0.0.1 / localhost) serves the HTML but has no Pages
// Functions behind it, so the pool API does not exist there. Say so instead of
// leaving the operator staring at "号池服务还没就绪".
const isLocalPreview = () =>
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(window.location.hostname);

export function Admin() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || "",
  );
  const [pool, setPool] = useState<WaPool>(emptyPool());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/wa/pool", {
        headers: { "x-wa-token": token },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("口令不正确。");
        setState("error");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(
          body.message ||
            (isLocalPreview()
              ? "本地预览只有静态页面，没有号池接口。请打开线上后台 https://www.tideoralab.com/wh-admin 管理客服号。"
              : "号池服务还没就绪。发布一次站点后即可使用，或联系技术人员检查 KV 绑定。"),
        );
        setState("error");
        return;
      }
      const data = (await res.json()) as { ok?: boolean; pool?: WaPool };
      if (data.ok && data.pool) {
        setPool({
          numbers: data.pool.numbers || [],
          refs: data.pool.refs || {},
          updatedAt: data.pool.updatedAt || 0,
        });
        setState("ready");
        return;
      }
      setError("返回数据格式不对，请刷新重试。");
      setState("error");
    } catch {
      setError(
        isLocalPreview()
          ? "本地预览只有静态页面，没有号池接口。请打开线上后台 https://www.tideoralab.com/wh-admin 管理客服号。"
          : "网络不通，请检查网络后刷新。",
      );
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (numbers: WaNumber[], opts: { resetStats?: boolean } = {}) => {
      setBusy(true);
      try {
        const res = await fetch("/api/wa/pool", {
          method: "POST",
          headers: { "content-type": "application/json", "x-wa-token": token },
          body: JSON.stringify({
            numbers,
            resetStats: opts.resetStats === true,
          }),
        });
        if (res.status === 401) {
          setError("口令已失效，请重新登录。");
          setState("error");
          return;
        }
        if (!res.ok) {
          notify("保存失败，请稍后重试");
          return;
        }
        const data = (await res.json()) as { ok?: boolean; pool?: WaPool };
        if (data.ok && data.pool) {
          setPool({
            numbers: data.pool.numbers || [],
            refs: data.pool.refs || {},
            updatedAt: data.pool.updatedAt || 0,
          });
        }
        notify("已保存，落地页立即生效");
      } catch {
        notify("保存失败：网络不通");
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const phone = String(f.get("phone") || "").replace(/\D/g, "");
    const name = String(f.get("name") || "").trim();
    if (phone.length < 7 || phone.length > 15) {
      notify("号码要带国家区号，7–15 位数字");
      return;
    }
    const countries = String(f.get("countries") || "ALL")
      .toUpperCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    const n = newNumber(name || "客服 " + (pool.numbers.length + 1), phone, {
      countries: countries.length ? countries : ["ALL"],
      weight: Math.max(1, Number(f.get("weight") || 1)),
      dailyCap: Math.max(0, Number(f.get("cap") || 0)),
    });
    save([...pool.numbers, n]);
    form.reset();
  }

  function patch(id: string, next: Partial<WaNumber>) {
    save(pool.numbers.map((n) => (n.id === id ? { ...n, ...next } : n)));
  }

  function remove(id: string) {
    if (!window.confirm("删除这个客服号？它的统计会一起清掉。")) return;
    save(pool.numbers.filter((n) => n.id !== id));
  }

  function resetStats() {
    if (!window.confirm("清空所有客服号的点击、独立访客和来源标记？")) return;
    save(
      pool.numbers.map((n) => ({
        ...n,
        clicks: 0,
        uv: [],
        dayCount: 0,
        dayKey: todayKey(),
      })),
      { resetStats: true },
    );
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setPool(emptyPool());
  }

  const active = pool.numbers.filter((n) => n.active).length;
  const today = todayKey();
  const todayClicks = pool.numbers.reduce(
    (n, x) => n + (x.dayKey === today ? x.dayCount : 0),
    0,
  );
  const totalClicks = pool.numbers.reduce((n, x) => n + (x.clicks || 0), 0);
  // Union, not sum: one visitor who clicked two different numbers is still
  // one person, and the operator reads this number as "how many people".
  const visitors = new Set<string>();
  pool.numbers.forEach((x) => x.uv.forEach((v) => visitors.add(v)));
  const share = (n: number) =>
    totalClicks ? Math.round((n / totalClicks) * 100) : 0;
  // Weight is a share of *new* visitors, so show it next to the number.
  const liveWeight = pool.numbers
    .filter((n) => n.active)
    .reduce((sum, n) => sum + Math.max(1, n.weight || 1), 0);
  const weightShare = (w: number) =>
    liveWeight ? Math.round((Math.max(1, w || 1) / liveWeight) * 100) : 0;
  const refs = Object.entries(pool.refs || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!token) {
    return (
      <div className="wh">
        <div className="wh-gate">
          <h1>WhatsApp 客服后台</h1>
          <p>
            输入管理口令后即可添加客服号、设置分流规则、查看点击数据。口令只需要输一次。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(
                new FormData(e.currentTarget).get("token") || "",
              ).trim();
              if (!v) return;
              sessionStorage.setItem(TOKEN_KEY, v);
              setToken(v);
            }}
          >
            <div className="wh-field">
              <label>管理口令</label>
              <input name="token" type="password" autoFocus required />
            </div>
            <button className="wh-btn">进入后台</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="wh">
      <div className="wh-wrap">
        <div className="wh-head">
          <div>
            <h1>WhatsApp 客服后台</h1>
            <p>
              全站（首页、产品页、落地页）的 WhatsApp 按钮都按这里的规则分配客服号，
              改完立即生效。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              className={"wh-tag " + (state === "ready" ? "on" : "off")}
            >
              {state === "ready"
                ? "已连接"
                : state === "loading"
                  ? "读取中"
                  : "未连接"}
            </span>
            <a
              className="wh-btn ghost"
              href="/lp"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} style={{ verticalAlign: "-2px" }} />{" "}
              落地页
            </a>
            <button
              className="wh-btn ghost"
              title="清掉本浏览器记住的客服，下次打开会像新访客一样重新分配"
              onClick={() => {
                try {
                  sessionStorage.removeItem("tideora-wa-prefer");
                  sessionStorage.removeItem("tideora-wa-target");
                  localStorage.removeItem("tideora-wa-number");
                } catch {
                  /* ignore */
                }
                notify("已清除本浏览器的客服绑定，刷新页面会重新分配");
              }}
            >
              <RefreshCw size={13} style={{ verticalAlign: "-2px" }} />{" "}
              重新分配我的会话
            </button>
            <button className="wh-btn ghost" onClick={signOut}>
              <LogOut size={13} style={{ verticalAlign: "-2px" }} /> 退出
            </button>
          </div>
        </div>

        {state === "error" ? (
          <div className="wh-gate">
            <h1>打不开号池</h1>
            <p>{error}</p>
            <button className="wh-btn" onClick={load}>
              <RefreshCw size={13} style={{ verticalAlign: "-2px" }} /> 重试
            </button>
            <button
              className="wh-btn ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={signOut}
            >
              换一个口令
            </button>
          </div>
        ) : (
          <>
            {active === 0 && (
              <div
                style={{
                  background: "#fff4e5",
                  border: "1px solid #f0c78a",
                  color: "#8a5a12",
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                <b>所有客服号都处于停用状态。</b>
                现在全站的 WhatsApp 按钮不会跳转到任何号码，访客会看到「客服正在接入」的提示。
                启用至少一个号才会恢复接单。
              </div>
            )}
            <div className="wh-stats">
              <div className="wh-stat">
                <small>累计跳转</small>
                <strong>{totalClicks}</strong>
              </div>
              <div className="wh-stat">
                <small>今日跳转</small>
                <strong>{todayClicks}</strong>
              </div>
              <div className="wh-stat">
                <small>独立访客</small>
                <strong>{visitors.size}</strong>
              </div>
              <div className="wh-stat">
                <small>客服号（启用 / 总数）</small>
                <strong>
                  {active} / {pool.numbers.length}
                </strong>
              </div>
            </div>

            <div className="wh-panel">
              <h2>添加客服号</h2>
              <form className="wh-form" onSubmit={add}>
                <div className="wh-field">
                  <label>客服备注</label>
                  <input name="name" placeholder="客服-Jason" />
                </div>
                <div className="wh-field">
                  <label>WhatsApp 号码</label>
                  <input name="phone" placeholder="12025550123" required />
                </div>
                <div className="wh-field">
                  <label>投放国家</label>
                  <input
                    name="countries"
                    placeholder="ALL 或 US,CA,GB"
                    defaultValue="ALL"
                  />
                </div>
                <div className="wh-field">
                  <label>权重</label>
                  <input
                    name="weight"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={1}
                  />
                </div>
                <div className="wh-field">
                  <label>每日上限</label>
                  <input name="cap" type="number" min={0} defaultValue={0} />
                </div>
                <button className="wh-btn" disabled={busy}>
                  <Plus size={13} style={{ verticalAlign: "-2px" }} /> 添加
                </button>
              </form>
            </div>

            <div className="wh-panel">
              <div className="wh-toolbar">
                <button className="wh-btn ghost" onClick={resetStats} disabled={busy}>
                  <RotateCcw size={13} style={{ verticalAlign: "-2px" }} />{" "}
                  重置统计
                </button>
                <button
                  className="wh-btn ghost"
                  disabled={busy}
                  onClick={() =>
                    save(pool.numbers.map((n) => ({ ...n, active: false })))
                  }
                >
                  全部暂停
                </button>
                <button
                  className="wh-btn ghost"
                  disabled={busy}
                  onClick={() =>
                    save(pool.numbers.map((n) => ({ ...n, active: true })))
                  }
                >
                  全部启用
                </button>
              </div>

              <div className="wh-table-wrap">
                <table className="wh-table">
                  <thead>
                    <tr>
                      <th>状态 · 点击切换</th>
                      <th>客服</th>
                      <th>号码</th>
                      <th>国家</th>
                      <th>权重</th>
                      <th>今日 / 上限</th>
                      <th>累计跳转</th>
                      <th>独立访客</th>
                      <th>占比</th>
                      <th>最近跳转</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pool.numbers.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ padding: 18, color: "#6c7a71" }}>
                          还没有客服号。添加一个之后，全站和落地页的 WhatsApp 按钮就会把客户分给他。
                        </td>
                      </tr>
                    )}
                    {pool.numbers.map((n) =>
                      editing === n.id ? (
                        <tr key={n.id}>
                          <td colSpan={11}>
                            <form
                              className="wh-row-edit"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                patch(n.id, {
                                  name: String(f.get("name") || n.name),
                                  phone: String(f.get("phone") || n.phone).replace(
                                    /\D/g,
                                    "",
                                  ),
                                  countries: String(f.get("countries") || "ALL")
                                    .toUpperCase()
                                    .split(/[,\s]+/)
                                    .filter(Boolean),
                                  weight: Math.max(1, Number(f.get("weight") || 1)),
                                  dailyCap: Math.max(0, Number(f.get("cap") || 0)),
                                });
                                setEditing(null);
                              }}
                            >
                              <input name="name" defaultValue={n.name} placeholder="备注" />
                              <input name="phone" defaultValue={n.phone} placeholder="号码" />
                              <input
                                name="countries"
                                defaultValue={n.countries.join(",")}
                                placeholder="ALL"
                              />
                              <input
                                name="weight"
                                type="number"
                                min={1}
                                defaultValue={n.weight}
                              />
                              <input
                                name="cap"
                                type="number"
                                min={0}
                                defaultValue={n.dailyCap}
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="wh-btn" type="submit">
                                  <Save size={12} /> 保存
                                </button>
                                <button
                                  className="wh-btn ghost"
                                  type="button"
                                  onClick={() => setEditing(null)}
                                >
                                  取消
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={n.id}>
                          <td>
                            <button
                              className={"wh-pill " + (n.active ? "on" : "off")}
                              style={{ border: 0, cursor: "pointer" }}
                              onClick={() => patch(n.id, { active: !n.active })}
                              title={
                                n.active
                                  ? "当前接单中，点击停用"
                                  : "当前已停用，点击启用"
                              }
                            >
                              {n.active ? "接单中" : "已停用"}
                            </button>
                          </td>
                          <td>{n.name}</td>
                          <td className="wh-phone">+{n.phone}</td>
                          <td>{n.countries.join(", ") || "ALL"}</td>
                          <td>
                            {n.weight}
                            {n.active && (
                              <span
                                style={{ color: "#8a9a90", fontSize: 11 }}
                                title="按权重算，这个号能分到的新客户比例"
                              >
                                {" "}
                                · {weightShare(n.weight)}%
                              </span>
                            )}
                          </td>
                          <td>
                            {n.dayKey === today ? n.dayCount : 0} /{" "}
                            {n.dailyCap || "∞"}
                          </td>
                          <td>
                            <b>{n.clicks || 0}</b>
                          </td>
                          <td>{n.uv.length}</td>
                          <td>
                            <span className="wh-share">
                              <i style={{ width: share(n.clicks || 0) + "%" }} />
                              <em>{share(n.clicks || 0)}%</em>
                            </span>
                          </td>
                          <td style={{ color: "#6c7a71", fontSize: 11.5 }}>
                            {n.lastClickAt
                              ? new Date(n.lastClickAt).toLocaleString("zh-CN", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button
                              className="wh-btn ghost"
                              style={{ padding: "5px 9px", marginRight: 6 }}
                              onClick={() => setEditing(n.id)}
                              aria-label="编辑"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className="wh-btn danger"
                              style={{ padding: "5px 9px" }}
                              onClick={() => remove(n.id)}
                              aria-label="删除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="wh-panel">
              <h2>来源标记 · 最近 8 个</h2>
              {refs.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "#6c7a71" }}>
                  还没有数据。客户每点一次按钮都会带一个 Ref 码（落地页是{" "}
                  <code>LP-TIRZEP-8F3K</code>，站内其它页面是{" "}
                  <code>SITE-8F3K</code>），客服在 WhatsApp 里看到它就知道客户
                  是从哪个产品问过来的。
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {refs.map(([k, v]) => (
                    <span key={k} className="wh-pill">
                      {k} · {v}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="wh-note">
              <b>统计口径</b>：客户每点一次 WhatsApp 按钮记 1 次跳转，按他实际被分到的
              那个客服号计数；独立访客按浏览器去重，同一个人点多次只算 1 人。
              占比 = 该号累计跳转 ÷ 全部跳转。
              <br />
              <b>权重</b>：是「新客户」的分流比例，<b>数字越大分得越多</b>，不是优先级。
              比如两个号权重 1 和 3，新客户大约 25% / 75%。权重只影响第一次分配。
              <br />
              <b>分流规则</b>：先按国家匹配（填 <code>ALL</code> 表示所有国家）→
              再看启用状态和每日上限 → 同一位访客始终回到同一个客服 → 剩下的按权重随机。
              所有客服都到上限时仍会给出号码，不会让客户空手离开。
              <br />
              <b>为什么你自己测试总是同一个号</b>：浏览器会记住「你聊过哪个客服」，
              之后一直回到他那（这是故意的，客户不会聊到一半换人）。想按新客户重新分配，
              点上面「重新分配我的会话」，或者用无痕窗口打开。
            </div>
          </>
        )}
      </div>
      {toast && <div className="wh-toast">{toast}</div>}
    </div>
  );
}
