import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { useStore } from "../lib/store";
import { categories, money } from "../lib/api";
import { Heading, Empty } from "../components/Common";
import { ProductCard } from "../components/ProductCard";
export function Shop() {
  const s = useStore(),
    [params, setParams] = useSearchParams(),
    category = params.get("category") || "All products",
    q = params.get("q") || "",
    sort = params.get("sort") || "featured",
    favorites = params.get("favorites") === "1";
  let list = s.products.filter(
    (p) =>
      (category === "All products" || p.category === category) &&
      (!q ||
        (p.name + p.subtitle + p.description)
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!favorites || s.favorites.includes(p.id)),
  );
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  if (sort === "new") list.sort((a, b) => b.id - a.id);
  function update(k: string, v: string) {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next);
  }
  return (
    <>
      <Heading
        title={
          favorites
            ? "Saved peptides"
            : q
              ? "Results for “" + q + "”"
              : "The catalogue."
        }
        subtitle="Research peptides by name, package size and USD price."
      />
      <section className="section shop-section">
        <div className="shop-toolbar">
          <div className="tabs">
            {["All products", ...categories].map((c) => (
              <button
                key={c}
                onClick={() => update("category", c)}
                className={c === category ? "active" : ""}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
          >
            {[
              ["featured", "Featured"],
              ["new", "Newest first"],
              ["price-asc", "Price: low to high"],
              ["price-desc", "Price: high to low"],
            ].map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <p className="result-count">
          {list.length} products ·{" "}
          {list.reduce((n, p) => n + (p.variants?.length || 1), 0)} package
          specifications · prices in USD
        </p>
        <div className="product-grid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {!list.length && <Empty title="No peptides match this filter." />}
      </section>
    </>
  );
}
export function ProductPage() {
  const { id } = useParams();
  return <ProductDetail key={id} id={Number(id)} />;
}
function ProductDetail({ id }: { id: number }) {
  const s = useStore(),
    p = s.products.find((p) => p.id === id),
    [selected, setSelected] = useState<number | null>(null),
    [qty, setQty] = useState(1),
    [image, setImage] = useState("");
  if (!p) return <Empty title="Product unavailable." />;
  const v = p.variants.find((v) => v.id === selected) || p.variants[0],
    stock = v?.stock ?? p.stock;
  return (
    <>
      <div className="page-heading">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / <Link to="/shop">Catalogue</Link> /{" "}
          {p.name}
        </div>
      </div>
      <section className="detail">
        <div className="detail-image">
          <img
            id="product-main-image"
            src={image || p.image}
            alt={p.name + " product image"}
          />
          <div className="product-thumbnails" aria-label="Product images">
            {p.gallery.map((src, i) => (
              <button
                key={src}
                aria-label={"View product image " + (i + 1)}
                aria-pressed={(image || p.image) === src}
                onClick={() => setImage(src)}
              >
                <img
                  src={src}
                  alt={p.name + " view " + (i + 1)}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <small>PRODUCT IMAGES FROM YUANTID</small>
        </div>
        <div className="detail-info">
          <span className="eyebrow">AURELIS / {p.category}</span>
          <h1>{p.name}</h1>
          <p className="subtitle">{p.subtitle}</p>
          <div className="price">
            {money(v?.price ?? p.price)} <small>USD / PACKAGE</small>
          </div>
          {p.variants.length > 0 && (
            <>
              <label className="variant-label" htmlFor="variant-select">
                Choose a package <span>{p.variants.length} sizes</span>
              </label>
              <select
                id="variant-select"
                className="variant-select"
                value={v.id}
                onChange={(e) => {
                  setSelected(Number(e.target.value));
                  setQty(1);
                }}
              >
                {p.variants.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.label} — {money(v.price)}
                    {!v.stock ? " · Unavailable" : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="product-specs">
            <div>
              <span>Series</span>
              <strong>{p.category}</strong>
            </div>
            <div>
              <span>Package</span>
              <strong>{v?.label || p.name}</strong>
            </div>
            <div>
              <span>Availability</span>
              <strong>{stock ? "In stock" : "Currently unavailable"}</strong>
            </div>
          </div>
          <div className="detail-actions">
            <div className="qty">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                −
              </button>
              <span>{qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() =>
                  setQty(Math.max(1, Math.min(stock, qty + 1, 99)))
                }
              >
                +
              </button>
            </div>
            <button
              className="btn"
              disabled={!stock}
              onClick={() => {
                if (s.addToCart(p.id, qty, v?.id ?? null)) s.setCartOpen(true);
              }}
            >
              Add to bag <ShoppingBag />
            </button>
            <button
              className="icon-button"
              aria-label="Save product"
              aria-pressed={s.favorites.includes(id)}
              onClick={() => s.toggleFavorite(id)}
            >
              <Heart />
            </button>
          </div>
          <div className="notice">
            The price shown is for the selected package. Place your order, then
            arrange payment with us on WhatsApp. Sold for research use only —
            not for human or veterinary use.
          </div>
          <details open>
            <summary>Product & package</summary>
            <p>{p.description}</p>
          </details>
          <details>
            <summary>Price & source</summary>
            <p>
              Price checked {p.source_checked_on} against the public listing
              below. We reproduce the published name, package label and price,
              and make no purity or testing claims of our own.
            </p>
            {p.source_url && (
              <a
                className="text-link"
                href={p.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View the original listing ↗
              </a>
            )}
          </details>
          <details>
            <summary>Shipping & returns</summary>
            <p>
              Shipping is $15 per order, or complimentary on orders of $299 or
              more before discounts. Dispatch and any return are arranged with
              you on WhatsApp after your order is placed.
            </p>
          </details>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>
            Also in the <em>catalogue.</em>
          </h2>
        </div>
        <div className="product-grid">
          {s.products
            .filter((x) => x.id !== id)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
    </>
  );
}
