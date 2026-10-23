import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { api, money } from "../lib/api";
import type { Quote, CartItem } from "../lib/types";
import { Modal, Summary, ErrorText } from "./Common";
export function CartDrawer() {
  const s = useStore(),
    navigate = useNavigate(),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [input, setInput] = useState(s.coupon);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setError("");
    if (s.cart.length)
      api<Quote>("/quote", "POST", { items: s.cart, coupon: s.coupon })
        .then((q) => {
          if (active) setQuote(q);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [s.cart, s.coupon]);
  function change(item: CartItem, delta: number) {
    const p = s.products.find((p) => p.id === item.id),
      v = p?.variants.find((v) => v.id === item.variant_id),
      qty = item.qty + delta;
    if (qty > Math.min(v?.stock ?? p?.stock ?? 0, 99)) {
      s.notify("The requested quantity exceeds available stock.");
      return;
    }
    s.setCart(
      s.cart.flatMap((i) =>
        i === item ? (qty > 0 ? [{ ...i, qty }] : []) : [i],
      ),
    );
  }
  async function apply(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/quote", "POST", { items: s.cart, coupon: input });
      s.setCoupon(input.trim().toUpperCase());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      className="cart-dialog"
      title={"Shopping bag (" + s.cart.reduce((n, i) => n + i.qty, 0) + ")"}
      onClose={() => s.setCartOpen(false)}
    >
      {s.cart.length ? (
        s.cart.map((i) => {
          const p = s.products.find((p) => p.id === i.id),
            v = p?.variants.find((v) => v.id === i.variant_id);
          return (
            <div className="cart-item" key={i.id + "/" + i.variant_id}>
              <img src={p?.image} alt={p?.name || "Unavailable product"} />
              <div>
                <h3>{p?.name || "Unavailable product"}</h3>
                <small>{v?.label}</small>
                <p>{money(v?.price ?? p?.price ?? 0)}</p>
                <div className="qty">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => change(i, -1)}
                  >
                    −
                  </button>
                  <span>{i.qty}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => change(i, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                className="remove"
                onClick={() => s.setCart(s.cart.filter((x) => x !== i))}
              >
                Remove
              </button>
            </div>
          );
        })
      ) : (
        <p>Your bag is empty.</p>
      )}
      {!!s.cart.length && (
        <div className="cart-summary">
          <div className="notice">
            Complimentary shipping over $299 · WELCOME10 saves 10% on your first
            order.
          </div>
          <form className="coupon-row" onSubmit={apply}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Promo code"
              placeholder="Enter promo code"
            />
            <button className="btn">Apply</button>
          </form>
          <ErrorText error={error} />
          {quote && <Summary quote={quote} />}
          <button
            className="btn full"
            disabled={!quote}
            onClick={() => {
              s.setCartOpen(false);
              if (!s.user) {
                s.setAuthOpen(true);
                s.notify("Sign in to continue to checkout.");
              } else navigate("/checkout");
            }}
          >
            Proceed to checkout ↗
          </button>
        </div>
      )}
      <button className="continue" onClick={() => s.setCartOpen(false)}>
        Continue browsing
      </button>
    </Modal>
  );
}
