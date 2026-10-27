import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { Order, Address } from "../lib/types";
import { Heading, Empty, Modal, ErrorText } from "../components/Common";
import { ProductCard } from "../components/ProductCard";
import { OrderCard } from "../components/OrderCard";
import { AddressFields } from "./Checkout";
export function Account() {
  const s = useStore(),
    [tab, setTab] = useState("orders"),
    [orders, setOrders] = useState<Order[]>([]),
    [addresses, setAddresses] = useState<Address[]>([]),
    [error, setError] = useState(""),
    [adding, setAdding] = useState(false),
    [address, setAddress] = useState<Address>({
      name: "",
      phone: "",
      detail: "",
    }),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!s.user) return;
    const [o, a] = await Promise.all([
      api<Order[]>("/orders"),
      api<Address[]>("/addresses"),
    ]);
    setOrders(o);
    setAddresses(a);
  }, [s.user]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  if (!s.user)
    return (
      <>
        <Heading title="Your TIDEORA account." />
        <Empty title="Your orders live here.">
          <p>
            Sign in to track orders, arrange payment on WhatsApp and manage
            delivery addresses.
          </p>
          <button className="btn" onClick={() => s.setAuthOpen(true)}>
            Sign in / Create account
          </button>
        </Empty>
      </>
    );
  return (
    <>
      <Heading
        title={"Hello, " + s.user.name}
        subtitle="Orders, delivery addresses and saved peptides."
      />
      <div className="account-layout">
        <aside className="account-nav">
          {[
            ["orders", "My orders"],
            ["favorites", "Saved products"],
            ["addresses", "Delivery addresses"],
            ["profile", "Account details"],
          ].map(([v, t]) => (
            <button
              key={v}
              className={tab === v ? "active" : ""}
              onClick={() => setTab(v)}
            >
              {t}
            </button>
          ))}
          {s.user.role === "admin" && (
            <Link className="btn sm" to="/admin">
              Merchant portal ↗
            </Link>
          )}
        </aside>
        <section>
          <ErrorText error={error} />
          {tab === "orders" &&
            (orders.length ? (
              orders.map((o) => (
                <OrderCard key={o.id} order={o} onUpdate={load} />
              ))
            ) : (
              <Empty title="No orders yet." />
            ))}
          {tab === "favorites" && (
            <div className="product-grid">
              {s.products
                .filter((p) => s.favorites.includes(p.id))
                .map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
            </div>
          )}
          {tab === "addresses" && (
            <>
              <button
                className="btn sm"
                onClick={() => {
                  setAddress({ name: "", phone: "", detail: "" });
                  setAdding(true);
                }}
              >
                Add delivery address
              </button>
              {addresses.map((a) => (
                <div className="panel" key={a.id}>
                  <h3>{a.name}</h3>
                  <p>{a.phone}</p>
                  <p>{a.detail}</p>
                  <button
                    className="text-link"
                    onClick={async () => {
                      try {
                        await api("/addresses", "DELETE", { id: a.id });
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete address
                  </button>
                </div>
              ))}
            </>
          )}
          {tab === "profile" && (
            <div className="panel">
              <h2>{s.user.name}</h2>
              <p>{s.user.email}</p>
              <button
                className="btn outline"
                onClick={() => s.signOut().catch((e) => setError(e.message))}
              >
                Sign out
              </button>
            </div>
          )}
        </section>
      </div>
      {adding && (
        <Modal title="Add delivery address" onClose={() => setAdding(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/addresses", "POST", address);
                await load();
                setAdding(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <AddressFields value={address} onChange={setAddress} />
            <ErrorText error={error} />
            <button className="btn full" disabled={busy}>
              Save address
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
