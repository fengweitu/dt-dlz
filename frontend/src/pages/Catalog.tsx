import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { useStore } from "../lib/store";
import { categories, money, whatsappUrl } from "../lib/api";
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
    stock = v?.stock ?? p.stock,
    // Variant image linkage: a variant's own image wins, otherwise the
    // product main image. Changing the variant resets any manual
    // thumbnail choice, so price and picture always move together.
    mainImage = image || v.image || p.image;
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
            src={mainImage}
            alt={p.name + " product image"}
          />
          <div className="product-thumbnails" aria-label="Product images">
            {p.gallery.map((src, i) => (
              <button
                key={src}
                aria-label={"View product image " + (i + 1)}
                aria-pressed={mainImage === src}
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
        </div>
        <div className="detail-info">
          <span className="eyebrow">TIDEORA / {p.category}</span>
          <h1>{p.name}</h1>
          <p className="subtitle">{p.subtitle}</p>
          <div className="price">
            {money(v?.price ?? p.price)} <small>USD / PACKAGE</small>
          </div>
          {p.variants.length > 0 && (
            <>
              <div className="variant-label">
                Choose a package <span>{p.variants.length} sizes</span>
              </div>
              <div
                role="radiogroup"
                aria-label="Choose a package"
                style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, margin: "12px 0 20px" }}
              >
                {p.variants.map((vv) => {
                  const active = vv.id === v.id;
                  return (
                    <button
                      key={vv.id}
                      role="radio"
                      aria-checked={active}
                      disabled={!vv.stock}
                      onClick={() => {
                        setSelected(vv.id);
                        setQty(1);
                        setImage("");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                        padding: "12px",
                        borderRadius: 12,
                        border: active ? "2px solid #0f2e26" : "1px solid #d8ddd5",
                        background: active ? "#eef5ee" : "#fff",
                        opacity: vv.stock ? 1 : 0.45,
                        cursor: vv.stock ? "pointer" : "not-allowed",
                        textAlign: "left",
                      }}
                    >
                      <img
                        src={vv.image || p.image}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 700, fontSize: 14, overflowWrap: "break-word" }}>
                          {vv.label}
                        </span>
                        <span style={{ display: "block", color: "#0f2e26", fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                          {money(vv.price)}
                          {!vv.stock ? " · Unavailable" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
            <a
              className="btn outline"
              href={whatsappUrl(
                `Hello, I'm interested in ${p.name} (${v?.label || p.name}) - ${money(v?.price ?? p.price)} per package, qty ${qty}. Could you please confirm availability and batch documentation?`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask on WhatsApp
            </a>
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
            <summary>Certificates & batch testing</summary>
            <p>
              Batch documentation is available on request via WhatsApp before
              you pay. Send us the product, package and batch number and we
              will share the lot-specific certificate of analysis (COA) for
              that batch. A COA lists the product identity, package label,
              purity result, test method, batch number and test date for that
              lot.
            </p>
            <p>
              If a COA is not yet available for a batch, we will tell you
              before payment rather than asking you to assume one exists.
              Independent re-testing within 30 days of delivery that does not
              match the COA can be raised on WhatsApp with the report, and we
              will arrange a replacement or refund for that batch.
            </p>
            <a className="btn outline" href={whatsappUrl(`Hello, could you please share the batch COA for ${p.name} (${v?.label || p.name})?`)} target="_blank" rel="noopener noreferrer">
              Request batch COA on WhatsApp
            </a>
          </details>
          <details>
            <summary>Shipping & returns</summary>
            <p>
              Shipping is $15 per order, or complimentary on orders of $500 or
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
