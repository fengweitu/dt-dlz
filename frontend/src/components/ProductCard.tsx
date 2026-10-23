import { Link, useNavigate } from "react-router-dom";
import { Heart, Plus, ArrowRight } from "lucide-react";
import type { Product } from "../lib/types";
import { money } from "../lib/api";
import { useStore } from "../lib/store";
export function ProductCard({ product: p }: { product: Product }) {
  const s = useStore(),
    navigate = useNavigate();
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={"/product/" + p.id}>
          <img src={p.image} alt={p.name + " product image"} loading="lazy" />
        </Link>
        <span className="product-tag">{p.tag || "COLLECTION"}</span>
        <button
          className={
            "favorite " + (s.favorites.includes(p.id) ? "selected" : "")
          }
          aria-label={"Save " + p.name}
          aria-pressed={s.favorites.includes(p.id)}
          onClick={() => s.toggleFavorite(p.id)}
        >
          <Heart />
        </button>
        <Link className="product-explore" to={"/product/" + p.id}>
          View product <ArrowRight />
        </Link>
      </div>
      <div className="product-info">
        <div className="product-category">
          {p.category}
          <span>USD</span>
        </div>
        <Link to={"/product/" + p.id}>
          <h3>{p.name}</h3>
        </Link>
        <p>{p.subtitle}</p>
        <div className="product-bottom">
          <span className="price">
            {money(p.price)}
            {p.max_price > p.price ? " – " + money(p.max_price) : ""}
          </span>
          <button
            className="quick-add"
            aria-label={"Add " + p.name + " to bag"}
            disabled={!p.stock}
            onClick={() =>
              p.variants.length > 1
                ? navigate("/product/" + p.id)
                : s.addToCart(p.id, 1, p.variants[0]?.id ?? null)
            }
          >
            <Plus />
          </button>
        </div>
      </div>
    </article>
  );
}
