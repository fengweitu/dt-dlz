import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { api, money } from "../lib/api";
import type { Quote, Address } from "../lib/types";
import { Heading, Empty, Summary, ErrorText } from "../components/Common";
export function Checkout() {
  const s = useStore(),
    navigate = useNavigate(),
    [quote, setQuote] = useState<Quote | null>(null),
    [addresses, setAddresses] = useState<Address[]>([]),
    [address, setAddress] = useState<Address>({
      name: "",
      phone: "",
      detail: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setQuote(null);
    if (s.user && s.cart.length)
      Promise.all([
        api<Quote>("/quote", "POST", { items: s.cart, coupon: s.coupon }),
        api<Address[]>("/addresses"),
      ])
        .then(([q, a]) => {
          if (active) {
            setQuote(q);
            setAddresses(a);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [s.cart, s.coupon, s.user]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const o = await api<{ id: string }>("/orders", "POST", {
        items: s.cart,
        coupon: s.coupon,
        address,
      });
      s.setCart([]);
      s.setCoupon("");
      await s.refreshProducts();
      navigate("/account");
      s.notify(
        "Order " +
          o.id +
          " created. Select Pay via WhatsApp to arrange payment.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!s.user)
    return (
      <Empty title="Sign in to continue.">
        <button className="btn" onClick={() => s.setAuthOpen(true)}>
          Sign in
        </button>
      </Empty>
    );
  if (!s.cart.length) return <Empty title="Your bag is empty." />;
  return (
    <>
      <Heading
        title="Complete your order."
        subtitle="Review your details and confirm your selection."
      />
      <div className="checkout">
        <form onSubmit={submit}>
          <div className="panel">
            <h2>01 / Delivery details</h2>
            {addresses.length > 0 && (
              <label>
                Saved addresses
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const a = addresses.find(
                      (a) => a.id === Number(e.target.value),
                    );
                    setAddress(a || { name: "", phone: "", detail: "" });
                  }}
                >
                  <option value="">Use a new address</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.detail}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <AddressFields value={address} onChange={setAddress} />
          </div>
          <div className="panel">
            <h2>02 / Delivery</h2>
            <p>
              Standard delivery ·{" "}
              {quote ? money(quote.shipping) : "Calculating…"}
            </p>
            <p>Shipping arrangements are confirmed separately.</p>
          </div>
          <div className="panel">
            <h2>03 / Payment</h2>
            <div className="notice">
              Payment is arranged through WhatsApp. After placing your order,
              select “Pay via WhatsApp” to contact us with your order summary.
              Your order stays unpaid until payment is confirmed.
            </div>
            <label className="check-label">
              <input type="checkbox" required /> I have reviewed my details.
              Order number, items and total will be included in the WhatsApp
              message draft.
            </label>
          </div>
          <ErrorText error={error} />
          <button className="btn full" disabled={busy || !quote}>
            {busy
              ? "Placing order…"
              : "Place order · " + money(quote?.total || 0) + " ↗"}
          </button>
        </form>
        <div>
          <div className="panel">
            <h2>Your selection</h2>
            {quote?.items.map((i) => (
              <div className="cart-item" key={i.id + "/" + i.variant_id}>
                <img src={i.image} alt={i.name} />
                <div>
                  <h3>{i.name}</h3>
                  <small>{i.variant_label}</small>
                  <p>Qty {i.qty}</p>
                </div>
                <span>{money(i.price * i.qty)}</span>
              </div>
            ))}
            {quote && <Summary quote={quote} />}
            <button
              type="button"
              className="text-link"
              onClick={() => s.setCartOpen(true)}
            >
              Edit bag
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
export function AddressFields({
  value,
  onChange,
}: {
  value: Address;
  onChange: (a: Address) => void;
}) {
  return (
    <div className="form-grid">
      <div className="form-two">
        <label>
          Full name
          <input
            name="name"
            required
            maxLength={50}
            autoComplete="name"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            required
            type="tel"
            pattern="[+0-9 \(\)\-]{6,30}"
            maxLength={30}
            autoComplete="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
          />
        </label>
      </div>
      <label>
        Shipping address
        <input
          name="detail"
          required
          minLength={6}
          maxLength={300}
          autoComplete="street-address"
          placeholder="Street, apartment, city, state and ZIP code"
          value={value.detail}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
        />
      </label>
    </div>
  );
}
