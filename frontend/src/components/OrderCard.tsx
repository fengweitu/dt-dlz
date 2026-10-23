import { useState } from "react";
import { api, money, statusLabel } from "../lib/api";
import type { Order } from "../lib/types";
import { useStore } from "../lib/store";
import { Modal, ErrorText } from "./Common";
export function OrderCard({
  order: o,
  admin = false,
  onUpdate,
}: {
  order: Order;
  admin?: boolean;
  onUpdate: () => Promise<void>;
}) {
  const s = useStore(),
    [action, setAction] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tracking, setTracking] = useState("");
  async function run(a: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (a === "pay") {
        const r = await api<{ url: string }>(
          "/orders/" + encodeURIComponent(o.id) + "/pay",
          "POST",
          {},
        );
        const u = new URL(r.url);
        if (u.protocol !== "https:" || u.hostname !== "wa.me")
          throw new Error("Invalid payment destination.");
        window.location.assign(u.href);
        return;
      }
      if (a === "ship")
        await api("/admin/orders", "PATCH", { id: o.id, tracking });
      else if (a === "confirm-payment" || a === "refund-confirm")
        await api(
          a === "confirm-payment" ? "/admin/confirm-payment" : "/admin/refund",
          "POST",
          { id: o.id },
        );
      else
        await api("/orders/" + encodeURIComponent(o.id) + "/" + a, "POST", {});
      setAction("");
      await onUpdate();
      await s.refreshProducts();
      s.notify("Order updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="order">
      <div className="order-header">
        <div>
          Order {o.id}
          <small>
            {new Date(o.created * 1000).toLocaleString("en-US")}
            {admin && " · " + o.email}
          </small>
        </div>
        <span className="status">{statusLabel(o.status)}</span>
      </div>
      {o.items.map((i) => (
        <div className="cart-item" key={i.id + "/" + i.variant_id}>
          <img src={i.image} alt={i.name} />
          <div>
            <h3>{i.name}</h3>
            <small>{i.variant_label}</small>
            <p>Qty {i.qty}</p>
          </div>
          <span>{money(i.price * i.qty, o.currency || "CNY")}</span>
        </div>
      ))}
      <p>
        Deliver to: {o.address.name} · {o.address.phone} · {o.address.detail}
      </p>
      {o.tracking && <p>Tracking: {o.tracking}</p>}
      <div className="order-bottom">
        <span>
          Order total <strong>{money(o.total, o.currency || "CNY")}</strong>
          <small>
            {" "}
            ({o.payment === "whatsapp" ? "WhatsApp" : "Previous payment method"}
            )
          </small>
        </span>
        {!admin && o.status === "待付款" && (
          <>
            <button
              className="btn outline sm"
              disabled={busy}
              onClick={() => setAction("cancel")}
            >
              Cancel order
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => run("pay")}
            >
              Pay via WhatsApp
            </button>
          </>
        )}
        {!admin && o.status === "已发货" && (
          <button
            className="btn sm"
            disabled={busy}
            onClick={() => setAction("receive")}
          >
            Confirm delivery
          </button>
        )}
        {!admin && ["待发货", "已发货", "已完成"].includes(o.status) && (
          <button
            className="text-link"
            disabled={busy}
            onClick={() => setAction("refund")}
          >
            Request refund
          </button>
        )}
        {admin && o.status === "待付款" && (
          <button
            className="btn sm"
            onClick={() => setAction("confirm-payment")}
          >
            Confirm received payment
          </button>
        )}
        {admin && o.status === "待发货" && (
          <button className="btn sm" onClick={() => setAction("ship")}>
            Add tracking & ship
          </button>
        )}
        {admin && o.status === "退款申请中" && (
          <button
            className="btn sm"
            onClick={() => setAction("refund-confirm")}
          >
            Record refund
          </button>
        )}
      </div>
      {!action && <ErrorText error={error} />}{" "}
      {action && (
        <Modal
          title={
            {
              cancel: "Cancel this order?",
              receive: "Confirm delivery?",
              refund: "Request a refund?",
              ship: "Shipment details",
              "confirm-payment": "Confirm received payment?",
              "refund-confirm": "Record refund?",
            }[action] || "Confirm"
          }
          onClose={() => {
            setAction("");
            setError("");
          }}
        >
          {action === "confirm-payment" && (
            <p>
              Confirm only after you have verified that payment for order {o.id}{" "}
              has been received.
            </p>
          )}
          {action === "refund-confirm" && (
            <p>
              This records the refund and restores inventory. It does not
              transfer money.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(action);
            }}
          >
            {action === "ship" && (
              <label>
                Carrier and tracking number
                <input
                  required
                  maxLength={100}
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
            )}
            <ErrorText error={error} />
            <button className="btn full" disabled={busy}>
              {busy ? "Please wait…" : "Confirm"}
            </button>
          </form>
        </Modal>
      )}
    </article>
  );
}
