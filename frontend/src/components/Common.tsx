import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { money } from "../lib/api";
import type { Quote } from "../lib/types";
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-heading">
      <div className="breadcrumb">
        <Link to="/">Home</Link> / {title}
      </div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
      <Link className="btn" to="/shop">
        Browse the catalogue ↗
      </Link>
    </div>
  );
}
export function Summary({ quote: q }: { quote: Quote }) {
  return (
    <>
      {[
        ["Subtotal", q.subtotal],
        ["Discount", -q.discount],
        ["Shipping", q.shipping],
        ["Total", q.total],
      ].map(([label, value]) => (
        <div
          className={"sum-row " + (label === "Total" ? "total" : "")}
          key={label}
        >
          <span>{label}</span>
          <span>{money(Number(value), q.currency)}</span>
        </div>
      ))}
    </>
  );
}
export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"react-modal " + className}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <button className="modal-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2 className="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
