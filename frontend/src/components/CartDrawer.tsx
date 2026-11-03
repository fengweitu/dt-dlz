import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useStore } from "../lib/store";
import { api, money, whatsappUrl } from "../lib/api";
import { refCode } from "../lp/wa";
import type { Quote, CartItem } from "../lib/types";
import { Modal, Summary, ErrorText } from "./Common";
export function CartDrawer() {
  const s = useStore(),
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

  // The store has no backend and no database, so there is no order to create:
  // the bag becomes a pre-written WhatsApp message. The agent confirms stock,
  // payment and shipping in the chat, and the customer never needs an account.
  const orderText = useMemo(() => {
    if (!quote || !quote.items.length) return "";
    const lines = quote.items.map(
      (i) =>
        `• ${i.name} — ${i.variant_label || "package"} × ${i.qty} = ${money(
          i.price * i.qty,
        )}`,
    );
    const totals = [`Subtotal: ${money(quote.subtotal)}`];
    if (quote.discount) totals.push(`Discount: -${money(quote.discount)}`);
    totals.push(
      quote.shipping
        ? `Shipping: ${money(quote.shipping)}`
        : "Shipping: complimentary",
    );
    totals.push(`Total: ${money(quote.total)}`);

    return [
      "Hi TIDEORA — I'd like to order:",
      "",
      ...lines,
      "",
      ...totals,
      ...(s.coupon ? ["", `Coupon: ${s.coupon}`] : []),
      "",
      `Ref: ${refCode("CART")}`,
      "",
      "Please confirm stock, payment method and delivery to my country.",
    ].join("\n");
  }, [quote, s.coupon]);
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
            Complimentary shipping over $500.
          </div>
          <ErrorText error={error} />
          {quote && <Summary quote={quote} />}
          {quote ? (
            <a
              className="btn full"
              href={whatsappUrl(orderText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => s.setCartOpen(false)}
            >
              Order on WhatsApp ↗
            </a>
          ) : (
            <button className="btn full" disabled>
              Preparing your bag…
            </button>
          )}
          <p className="cart-note">
            No account needed. We confirm stock, payment and shipping in the
            chat — the bag above is copied into the message for you.
          </p>
        </div>
      )}
      <button className="continue" onClick={() => s.setCartOpen(false)}>
        Continue browsing
      </button>
    </Modal>
  );
}
