import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, money, categories } from "../lib/api";
import { useStore } from "../lib/store";
import type { Product, Order, Coupon } from "../lib/types";
import { Heading, Empty, Modal, ErrorText } from "../components/Common";
import { OrderCard } from "../components/OrderCard";
export function Admin() {
  const s = useStore(),
    [tab, setTab] = useState("overview"),
    [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [coupons, setCoupons] = useState<Coupon[]>([]),
    [overview, setOverview] = useState<Record<string, number>>({}),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Partial<Product> | null>(null),
    [newCoupon, setNewCoupon] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (s.user?.role !== "admin") return;
    setError("");
    if (tab === "products")
      setProducts(await api<Product[]>("/admin/products"));
    if (tab === "orders") setOrders(await api<Order[]>("/admin/orders"));
    if (tab === "coupons") setCoupons(await api<Coupon[]>("/admin/coupons"));
    if (tab === "overview")
      setOverview(await api<Record<string, number>>("/admin/overview"));
  }, [s.user, tab]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  if (s.user?.role !== "admin")
    return (
      <>
        <Heading title="Merchant portal" />
        <Empty title="Merchant access.">
          <p>Sign in with your configured administrator account.</p>
          <button className="btn" onClick={() => s.setAuthOpen(true)}>
            Administrator sign in
          </button>
        </Empty>
      </>
    );
  async function saveCoupon(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      await api("/admin/coupons", "POST", {
        ...data,
        percent: Number(data.percent),
        minimum: Math.round(Number(data.minimum) * 100),
        active: 1,
      });
      setNewCoupon(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="Merchant portal" subtitle="AURELIS / STORE MANAGEMENT" />
      <div className="account-layout">
        <aside className="account-nav">
          {["overview", "products", "orders", "coupons"].map((t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "coupons" ? "Promotions" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </aside>
        <section>
          <ErrorText error={error} />
          {tab === "overview" && (
            <>
              <div className="admin-stats">
                {[
                  ["revenue", "Recorded revenue (USD)"],
                  ["orders", "Total orders"],
                  ["users", "Customers"],
                  ["subscribers", "Subscribers"],
                ].map(([key, label]) => (
                  <div className="stat" key={key}>
                    <small>{label}</small>
                    <strong>
                      {key === "revenue"
                        ? money(overview[key] || 0)
                        : overview[key] || 0}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h3>Welcome to AURELIS administration.</h3>
                <p>Manage your catalog, inventory, orders and promotions.</p>
                <div className="notice">
                  Payments are arranged via WhatsApp. Confirm payment only after
                  independently verifying receipt. Shipping and email delivery
                  are not connected.
                </div>
              </div>
            </>
          )}
          {tab === "products" && (
            <>
              <div className="admin-toolbar">
                <h3>Products</h3>
                <button className="btn sm" onClick={() => setEditing({})}>
                  ＋ New product
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Product",
                        "Collection",
                        "Price",
                        "Stock",
                        "Status",
                        "Actions",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <img src={p.image} alt="" />
                          {p.name}
                        </td>
                        <td>{p.category}</td>
                        <td>{money(p.price)}</td>
                        <td>{p.stock}</td>
                        <td>{p.active ? "Active" : "Archived"}</td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => setEditing(p)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "orders" &&
            (orders.length ? (
              orders.map((o) => (
                <OrderCard key={o.id} order={o} admin onUpdate={load} />
              ))
            ) : (
              <Empty title="No orders yet." />
            ))}
          {tab === "coupons" && (
            <>
              <div className="admin-toolbar">
                <h3>Promotions</h3>
                <button className="btn sm" onClick={() => setNewCoupon(true)}>
                  ＋ New promotion
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Promo code",
                        "Discount",
                        "Minimum spend",
                        "Status",
                        "Actions",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.code}>
                        <td>{c.code}</td>
                        <td>{c.percent}% off</td>
                        <td>{money(c.minimum)}</td>
                        <td>{c.active ? "Active" : "Inactive"}</td>
                        <td>
                          <button
                            onClick={async () => {
                              try {
                                await api("/admin/coupons", "POST", {
                                  ...c,
                                  active: !c.active,
                                });
                                await load();
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            {c.active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            await s.refreshProducts();
          }}
        />
      )}
      {newCoupon && (
        <Modal title="New promotion" onClose={() => setNewCoupon(false)}>
          <form className="form-grid" onSubmit={saveCoupon}>
            <label>
              Promo code
              <input name="code" required maxLength={30} />
            </label>
            <label>
              Discount percentage
              <input name="percent" type="number" min={1} max={90} required />
            </label>
            <label>
              Minimum spend (USD)
              <input
                name="minimum"
                type="number"
                min={0}
                step="0.01"
                defaultValue={0}
                required
              />
            </label>
            <ErrorText error={error} />
            <button className="btn" disabled={busy}>
              Create promotion
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function ProductEditor({
  product: p,
  onClose,
  onSaved,
}: {
  product: Partial<Product>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [variants, setVariants] = useState(p.variants || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      data = Object.fromEntries(f);
    try {
      await api("/admin/products", p.id ? "PATCH" : "POST", {
        ...data,
        id: p.id,
        price: Math.round(Number(data.price) * 100),
        old_price: Math.round(Number(data.old_price) * 100),
        stock: Number(data.stock),
        active: f.has("active"),
        variants: p.variants?.length ? variants : undefined,
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={p.id ? "Edit product" : "New product"} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label>
          Product name
          <input name="name" required maxLength={100} defaultValue={p.name} />
        </label>
        <label>
          Subtitle
          <input name="subtitle" required defaultValue={p.subtitle} />
        </label>
        <div className="form-two">
          <label>
            Collection
            <select name="category" defaultValue={p.category || categories[0]}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input name="tag" maxLength={40} defaultValue={p.tag} />
          </label>
        </div>
        {variants.length > 0 && (
          <fieldset className="variant-editor">
            <legend>Specifications · USD</legend>
            {variants.map((v, i) => (
              <div className="variant-edit-row" key={v.id}>
                <label>
                  Specification
                  <input
                    required
                    maxLength={150}
                    value={v.label}
                    onChange={(e) =>
                      setVariants(
                        variants.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <div className="form-two">
                  <label>
                    Price (USD)
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={v.price / 100}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  price: Math.round(
                                    Number(e.target.value) * 100,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Stock
                    <input
                      type="number"
                      required
                      min={0}
                      max={1000000}
                      value={v.stock}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x, j) =>
                            j === i
                              ? { ...x, stock: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={!!v.active}
                    onChange={(e) =>
                      setVariants(
                        variants.map((x, j) =>
                          j === i
                            ? { ...x, active: e.target.checked ? 1 : 0 }
                            : x,
                        ),
                      )
                    }
                  />{" "}
                  Active
                </label>
              </div>
            ))}
          </fieldset>
        )}
        <div className="form-two">
          <label>
            Base price (USD)
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={p.price ? p.price / 100 : ""}
            />
          </label>
          <label>
            Compare-at price (USD)
            <input
              name="old_price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(p.old_price || 0) / 100}
            />
          </label>
        </div>
        <label>
          Stock
          <input
            name="stock"
            type="number"
            min={0}
            required
            defaultValue={p.stock || 0}
          />
        </label>
        <label>
          Product image URL or local path
          <input name="image" required defaultValue={p.image} />
        </label>
        <label>
          Description
          <textarea name="description" required defaultValue={p.description} />
        </label>
        <label className="check-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={p.active !== 0}
          />{" "}
          Available for sale
        </label>
        <ErrorText error={error} />
        <button className="btn" disabled={busy}>
          Save product
        </button>
      </form>
    </Modal>
  );
}
