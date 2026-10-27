import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Box, ShieldCheck, UserRound } from "lucide-react";
import { useStore } from "../lib/store";
import { categories } from "../lib/api";
import { ProductCard } from "../components/ProductCard";
import { JournalCards } from "./Information";
export function Home() {
  const { products } = useStore(),
    [tab, setTab] = useState("Featured"),
    specs = products.reduce((n, p) => n + (p.variants?.length || 1), 0);
  return (
    <>
      <section className="peptide-hero">
        <div className="hero-type">
          <span className="eyebrow">
            <i /> RESEARCH PEPTIDES · USD PRICING
          </span>
          <h1>
            Research
            <br />
            Peptides,
            <br />
            <em>by the vial.</em>
          </h1>
          <p>
            {products.length} peptides, {specs} package specifications.
            <br />
            Names, milligrams per vial and USD prices, all on one page.
          </p>
          <div className="hero-ctas">
            <Link className="btn gold" to="/shop">
              Browse the catalogue <ArrowRight />
            </Link>
            <Link className="hero-secondary" to="/quality">
              How we list prices ↗
            </Link>
          </div>
          <p>
            Free shipping on orders over $500.
          </p>
          <div className="hero-footnote">
            <img
              src="/images/tideora-logo-icon.jpg"
              alt="Tideora"
              style={{ height: 40, width: "auto", display: "block" }}
            />
            <div>
              FOR RESEARCH USE ONLY
              <small>NOT FOR HUMAN OR VETERINARY USE</small>
            </div>
          </div>
        </div>
        <div className="hero-art">
          <img
            src="/images/aurelis-hero.svg"
            alt="Tideora peptide packaging concepts on architectural stone plinths"
            fetchPriority="high"
          />
          <div className="hero-art-top">
            <span>GLP SERIES · SINGLE PEPTIDES · BLENDS</span>
            <span>01 — {products.length}</span>
          </div>
          <div className="hero-art-bottom">
            <span>Every package priced separately.</span>
            <Link to="/shop" aria-label="Browse the catalogue">
              ↗
            </Link>
          </div>
        </div>
      </section>
      <section className="principle-strip">
        <div>
          <span className="strip-symbol">✧</span> {products.length} peptides,{" "}
          {specs} specifications
        </div>
        <div>
          <Box /> Sealed vials, sold by the package
        </div>
        <div>
          <ShieldCheck /> Batch COA available on request
        </div>
        <div>
          <UserRound /> Ordering and payment over WhatsApp
        </div>
      </section>
      <section className="section collection-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">THE CATALOGUE</span>
            <h2>
              Every peptide, every <em>specification.</em>
            </h2>
            <p>
              GLP series, single peptides and blends. Pick a package size to see
              its exact price in USD.
            </p>
          </div>
          <Link className="text-link" to="/shop">
            View all {products.length} products <ArrowRight />
          </Link>
        </div>
        <div className="collection-toolbar">
          <div className="tabs">
            {["Featured", ...categories].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span>
            {products.length} PRODUCTS / {specs} SPECIFICATIONS
          </span>
        </div>
        <div className="product-grid">
          {products
            .filter((p) => tab === "Featured" || p.category === tab)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
        <div className="collection-note">
          <span>GLP SERIES · SINGLE PEPTIDES · PEPTIDE BLENDS</span>
          <span>USD prices checked October 23, 2026.</span>
        </div>
      </section>
      <section className="philosophy-band">
        <div className="philosophy-art">
          <div className="orbital orbital-one" />
          <div className="orbital orbital-two" />
          <span className="philosophy-monogram">T</span>
          <span className="art-caption">FOR RESEARCH USE ONLY.</span>
          <div className="art-coordinates">
            TIDEORA
            <br />
            EST. 2026
          </div>
        </div>
        <div className="philosophy-copy">
          <span className="eyebrow">WHERE THE NUMBERS COME FROM</span>
          <h2>
            Catalogue prices,
            <br />
            <em>traceable to the source.</em>
          </h2>
          <p>
            Every product page shows the name, package label and price we
            checked, with the date we checked it. Batch documentation is
            separate: request the lot-specific COA on WhatsApp before you pay,
            and we will share that batch's document or tell you if one is not
            yet available.
          </p>
          <Link to="/quality" className="text-link">
            How we list specifications <ArrowRight />
          </Link>
          <div className="philosophy-values">
            <span>01 / NAMES</span>
            <span>02 / SPECIFICATIONS</span>
            <span>03 / PRICES</span>
          </div>
        </div>
      </section>
      <section className="section details-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">BEFORE YOU ORDER</span>
            <h2>
              What's on every <em>product page.</em>
            </h2>
          </div>
        </div>
        <div className="standards-grid">
          {[
            [
              "01",
              "The peptide",
              "The name as published, with the catalogue photograph of that vial.",
            ],
            [
              "02",
              "The package",
              "Each package label listed in full — 5mg × 10 vials, 10mg × 10 vials — with its own price.",
            ],
            [
              "03",
              "The price",
              "The USD price, the date it was checked, and batch documentation on request via WhatsApp.",
            ],
          ].map(([n, t, d]) => (
            <Link to="/quality" className="standard-card" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <span className="standard-arrow">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section journal-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">RESEARCH NOTES</span>
            <h2>
              How to read a <em>specification.</em>
            </h2>
          </div>
          <Link className="text-link" to="/journal">
            All research notes ↗
          </Link>
        </div>
        <JournalCards />
      </section>
      <section className="closing-band">
        <span className="eyebrow">READY TO ORDER?</span>
        <h2>
          Browse the <em>catalogue.</em>
        </h2>
        <Link className="btn gold" to="/shop">
          See all {products.length} peptides <ArrowRight />
        </Link>
        <span className="closing-watermark">TIDEORA</span>
      </section>
    </>
  );
}
