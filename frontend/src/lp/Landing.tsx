import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Check,
  Truck,
  ShieldCheck,
  FileCheck2,
  Package,
  Sparkles,
  X,
  ArrowRight,
} from "lucide-react";
import type { Product } from "../lib/types";
import {
  allProducts,
  byCategory,
  categoryImage,
  CATEGORIES,
  mgRange,
  packageLabel,
  slugify,
} from "./data";
import {
  assign,
  generalMessage,
  productMessage,
  refCode,
  track,
  waUrl,
} from "./wa";
import "./lp.css";

/** Any /lp* path renders this one page — old per-product links included. */
export function isLandingPath(path: string): boolean {
  return path === "/lp" || path.startsWith("/lp/");
}

/** The five vials on the poster. Transparent PNGs cut from the real product
 *  photos by scripts/cutout_vials.py — never substitute a stock bottle. */
const POSTER_VIALS = [
  {
    slug: "semaglutide",
    name: "Semaglutide",
    dose: "5 mg · 99% HPLC",
    img: "/images/lp/semaglutide.webp",
    w: 460,
    h: 816,
  },
  {
    slug: "tirzepatide",
    name: "Tirzepatide",
    dose: "15 mg · 99% HPLC",
    img: "/images/lp/tirzepatide.webp",
    w: 460,
    h: 835,
  },
  {
    slug: "retatrutide",
    name: "Retatrutide",
    dose: "20 mg · 99% HPLC",
    img: "/images/lp/retatrutide.webp",
    w: 460,
    h: 830,
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    dose: "10 mg · 99% HPLC",
    img: "/images/lp/ipamorelin.webp",
    w: 460,
    h: 840,
  },
  {
    slug: "slu-pp-332",
    name: "SLU-PP-332",
    dose: "5 mg · 99% HPLC",
    img: "/images/lp/slu-pp-332.webp",
    w: 460,
    h: 866,
  },
];

export function Landing() {
  const products = useMemo(() => allProducts(), []);
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<{ phone: string; url: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [noAgent, setNoAgent] = useState(false);

  const shown = byCategory(filter);

  useEffect(() => {
    document.title = "TIDEORA — Research Peptides";
    track("ViewContent", {
      content_name: "Catalogue",
      content_category: "Research peptides",
      content_type: "product",
    });
    window.scrollTo(0, 0);
  }, []);

  // The poster's display face. Loaded only on the landing page; if it never
  // arrives the headline falls back to Georgia, which the page already used.
  useEffect(() => {
    if (document.getElementById("lp-poster-font")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    const link = document.createElement("link");
    link.id = "lp-poster-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600;1,700&display=swap";
    document.head.append(pre, link);
  }, []);

  async function handoff(product?: Product) {
    if (busy) return;
    setBusy(true);
    const prefix = product
      ? "LP-" + slugify(product.name).slice(0, 6).toUpperCase()
      : "LP-ALL";
    const ref = refCode(prefix);
    const text = product ? productMessage(product, ref) : generalMessage(ref);
    track("Contact", {
      content_name: product ? product.name : "Price list request",
      content_ids: product ? [String(product.id)] : [],
    });
    const target = await assign({
      ref,
      product: product ? slugify(product.name) : "catalogue",
    });
    // No enabled agent number: never invent one, never reuse a paused one.
    if (!target.ok || !target.phone) {
      setBusy(false);
      setNoAgent(true);
      return;
    }
    const url = waUrl(target.phone, text);
    window.location.href = url;
    // If the app handoff did not happen (desktop, in-app browser, blocked
    // intent), offer the number so the lead is not lost.
    window.setTimeout(() => {
      setBusy(false);
      if (document.visibilityState === "visible") {
        setFallback({ phone: target.phone, url });
      }
    }, 2600);
  }

  function pickFilter(key: string) {
    setFilter(key);
    const el = document.getElementById("catalogue");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="lp">
      <div className="lp-topline">
        For laboratory research use only · Not for human or veterinary use
      </div>

      <header className="lp-head">
        <a className="lp-brand" href="/" aria-label="TIDEORA home">
          <img src="/images/tideora-logo-horizontal.jpg" alt="TIDEORA" />
        </a>
        <button className="lp-head-cta" onClick={() => handoff()}>
          <MessageCircle /> WhatsApp
        </button>
      </header>

      <section className="lp-poster">
        <div className="lp-poster-top">
          <span className="lp-poster-word">TIDEORA</span>
          <span className="lp-poster-badge">
            <Sparkles size={11} /> Premium research peptides
          </span>
          <h1 className="lp-poster-title">
            Research-Grade Peptides,
            <br />
            <em>Backed by Verification</em>
          </h1>
        </div>

        <div className="lp-poster-frame">
          <div className="lp-poster-stage">
            <div className="lp-poster-row">
              {POSTER_VIALS.map((v) => (
                <div className="lp-poster-item" key={v.slug}>
                  <div className="lp-poster-vial">
                    <img
                      className="lp-poster-bottle"
                      src={v.img}
                      alt={v.name + " vial"}
                      width={v.w}
                      height={v.h}
                      fetchPriority="high"
                    />
                    <span className="lp-poster-mirror" aria-hidden="true">
                      <img src={v.img} alt="" width={v.w} height={v.h} />
                    </span>
                  </div>
                  <span className="lp-poster-tag">
                    <b>{v.name}</b>
                    <i>{v.dose}</i>
                  </span>
                </div>
              ))}
            </div>
            <span className="lp-poster-legend">
              {POSTER_VIALS.map((v) => (
                <i key={v.slug}>{v.name}</i>
              ))}
            </span>
          </div>

          <svg className="lp-seal" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <radialGradient id="lpSealG" cx="36%" cy="28%" r="82%">
                <stop offset="0%" stopColor="#dcc28b" />
                <stop offset="52%" stopColor="#bd9a5c" />
                <stop offset="100%" stopColor="#8b6b33" />
              </radialGradient>
              <path
                id="lpSealArc"
                d="M60,60 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0"
              />
            </defs>
            <circle cx="60" cy="60" r="58" fill="url(#lpSealG)" />
            <circle
              cx="60"
              cy="60"
              r="52.5"
              fill="none"
              stroke="#f6e8ca"
              strokeOpacity=".5"
              strokeWidth=".7"
            />
            <circle
              cx="60"
              cy="60"
              r="34"
              fill="none"
              stroke="#f6e8ca"
              strokeOpacity=".38"
              strokeWidth=".6"
            />
            <text className="lp-seal-ring" fill="#f8eed6">
              <textPath href="#lpSealArc" startOffset="4">
                PREMIUM · RESEARCH GRADE
              </textPath>
            </text>
            <path
              d="M60 44.6l3.9 7.9 8.7 1.3-6.3 6.1 1.5 8.7L60 64.5l-7.8 4.1 1.5-8.7-6.3-6.1 8.7-1.3z"
              fill="#f8eed6"
              opacity=".94"
            />
          </svg>
        </div>

        <div className="lp-poster-cta">
          <button className="lp-cta" disabled={busy} onClick={() => handoff()}>
            <MessageCircle />
            {busy ? "Opening WhatsApp…" : "Chat on WhatsApp"}
          </button>
          <p className="lp-cta-note">
            One message. <b>Price list</b>, shipping and COA come back in the
            same chat.
          </p>
        </div>

        {/* The four promises, set as the poster's closing colophon rather than
            as another card row — typography only, no icons, no boxes. */}
        <div className="lp-poster-promise">
          <div className="lp-poster-promises">
            <div>
              <b>Purity</b>
              <span>≥99% on every batch, HPLC-verified</span>
            </div>
            <div>
              <b>One specialist</b>
              <span>The same person, start to finish</span>
            </div>
            <div>
              <b>In transit</b>
              <span>Whatever happens, we answer for it</span>
            </div>
          </div>
          <p className="lp-poster-pledge">
            A reputation is worth more than a single order.
          </p>
        </div>
      </section>

      <div className="lp-strip">
        <div>
          <Truck /> Dispatched within 24h
        </div>
        <div>
          <ShieldCheck /> Free shipping over $500
        </div>
        <div>
          <FileCheck2 /> Batch COA before payment
        </div>
        <div>
          <Package /> Sealed vials, by the pack
        </div>
      </div>

      <section className="lp-intro">
        <img
          className="lp-intro-logo"
          src="/images/tideora-logo-icon.png"
          alt="TIDEORA"
        />
        <div>
          <h2>TIDEORA</h2>
          <p>
            We supply {products.length} research peptides by the package —{" "}
            {products.reduce((n, p) => n + p.variants.length, 0)} package
            specifications in total: GLP-series compounds, single peptides and
            pre-combined blends, in sealed vials. Every listing is a real
            catalogue entry with its package sizes published, and every lot is
            documented. We keep the ordering conversation on WhatsApp so that
            stock, shipping and the batch certificate are confirmed by a person
            before you pay — not by a checkout form.
          </p>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span>The collection</span>
          <h2>Three groups, one catalogue.</h2>
        </div>
        <div className="lp-collections">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className="lp-collection"
              onClick={() => pickFilter(c.key)}
            >
              <img src={categoryImage(c.key)} alt={c.label} loading="lazy" />
              <span className="lp-collection-body">
                <strong>{c.label}</strong>
                <small>{c.blurb}</small>
                <span className="lp-collection-count">
                  {byCategory(c.key).length} products <ArrowRight size={13} />
                </span>
              </span>
            </button>
          ))}
        </div>
        <button className="lp-wide-cta" onClick={() => handoff()}>
          Contact us for the full price list <ArrowRight size={16} />
        </button>
      </section>

      <section className="lp-section alt" id="catalogue">
        <div className="lp-section-head">
          <span>All products</span>
          <h2>Every peptide we stock.</h2>
          <p>
            Tap any product to ask for its price, current stock and the batch
            COA. Package sizes are listed on each card.
          </p>
        </div>

        <div className="lp-tabs" role="tablist" aria-label="Filter products">
          {["All", ...CATEGORIES.map((c) => c.key)].map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              className={"lp-tab" + (filter === k ? " on" : "")}
              onClick={() => setFilter(k)}
            >
              {k === "All" ? "All products" : CATEGORIES.find((c) => c.key === k)?.label}
              <span>{byCategory(k).length}</span>
            </button>
          ))}
        </div>

        <div className="lp-grid">
          {shown.map((p) => (
            <button
              key={p.id}
              className="lp-pc"
              onClick={() => handoff(p)}
              aria-label={"Ask about " + p.name + " on WhatsApp"}
            >
              <span className="lp-pc-img">
                <img
                  src={p.image}
                  alt={p.name + " vial"}
                  loading="lazy"
                  width={600}
                  height={600}
                />
              </span>
              <span className="lp-pc-body">
                <span className="lp-pc-cat">{p.category}</span>
                <strong>{p.name}</strong>
                <span className="lp-pc-meta">
                  {mgRange(p)} · {packageLabel(p)}
                </span>
                <span className="lp-pc-cta">
                  Ask price <ArrowRight size={13} />
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="lp-grid-note">
          Prices are not published on this page — they change with the batch and
          the package size. Ask in chat and you get the current figure for the
          exact pack you want.
        </p>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span>Quality control</span>
          <h2>See what is documented before you pay.</h2>
          <p>
            Every lot is analysed by an independent laboratory. Ask for the
            certificate for the batch you would receive and we send that
            document — or tell you it is not published yet.
          </p>
        </div>
        <div className="lp-quality">
          <div className="lp-quality-art">
            <img
              src="/images/tideora-test-report-sample.jpg"
              alt="Sample certificate of analysis"
              loading="lazy"
            />
            <span>Sample COA</span>
          </div>
          <ul className="lp-quality-list">
            <li>
              <Check /> <b>Identity, mass and purity</b> measured by HPLC and
              mass spectrometry, printed on each certificate.
            </li>
            <li>
              <Check /> <b>Lot number and test date</b> on the document, so the
              report can be matched to the batch you receive.
            </li>
            <li>
              <Check /> <b>Endotoxin and sterility</b> screened per lot, with
              the measured value on the record.
            </li>
            <li>
              <Check /> <b>Re-verification</b>: if an independent re-test
              disagrees with the certificate, raise it with the order number and
              we make it right.
            </li>
          </ul>
        </div>
        <button className="lp-wide-cta" onClick={() => handoff()}>
          Request a batch COA <ArrowRight size={16} />
        </button>
      </section>

      <section className="lp-section alt">
        <div className="lp-section-head">
          <span>How ordering works</span>
          <h2>One tap, then it is a conversation.</h2>
        </div>
        <div className="lp-steps">
          <div className="lp-step">
            <em>1</em>
            <div>
              <strong>Tap a product or the button</strong>
              <span>WhatsApp opens with the product already written in.</span>
            </div>
          </div>
          <div className="lp-step">
            <em>2</em>
            <div>
              <strong>Press send</strong>
              <span>Nothing to type, no contact to save first.</span>
            </div>
          </div>
          <div className="lp-step">
            <em>3</em>
            <div>
              <strong>We answer with the numbers</strong>
              <span>Price for your pack, stock, shipping and the COA.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span>Before you order</span>
          <h2>Straight answers.</h2>
        </div>
        <div className="lp-faq">
          <details open>
            <summary>Why are prices not shown on this page?</summary>
            <p>
              Because a price belongs to a specific package and a specific
              batch. Instead of printing a number that may be out of date, we
              send you the current price for the pack you ask about, together
              with stock and shipping.
            </p>
          </details>
          <details>
            <summary>What exactly is in one package?</summary>
            <p>
              A package is a box of sealed vials, not a single vial. Each card
              lists the milligram range and how many package sizes exist — for
              example Tirzepatide runs from 5mg to 60mg per vial across nine
              packs.
            </p>
          </details>
          <details>
            <summary>Can I see the COA for the batch I would receive?</summary>
            <p>
              Yes — ask before paying. We send the lot-specific certificate for
              that batch, or tell you plainly that it is not published yet. We
              do not substitute a report from a different lot.
            </p>
          </details>
          <details>
            <summary>How does payment work?</summary>
            <p>
              Nothing is charged on this page. You confirm stock and shipping in
              the chat, we give you the payment options that work for your
              country, and dispatch happens once payment is confirmed.
            </p>
          </details>
          <details>
            <summary>Where do you ship, and how fast?</summary>
            <p>
              Worldwide by tracked express courier. Orders confirmed before the
              daily cut-off leave within 24 hours Monday to Friday; weekend
              orders go out on Monday. Free shipping over $500, otherwise a flat
              $15 per order.
            </p>
          </details>
          <details>
            <summary>
              What if the parcel is lost, delayed or damaged in transit?
            </summary>
            <p>
              We stay on the order until it reaches you. If tracking stalls, the
              parcel is held at customs, or it arrives damaged, message the same
              specialist who handled your order and we reship it or settle it
              with you. Chasing the courier is our job, not yours.
            </p>
          </details>
          <details>
            <summary>Is this for human use?</summary>
            <p>
              No. Everything here is supplied strictly for laboratory and
              in-vitro research. It is not a medicine, a supplement or a
              therapeutic product, and it is not for human or veterinary use.
            </p>
          </details>
        </div>
      </section>

      <section className="lp-close">
        <span>Ready when you are</span>
        <h2>Send one message and get the price list.</h2>
        <p>
          We reply during business hours with prices, stock, shipping and the
          certificate — before anything is paid.
        </p>
        <button className="lp-cta" disabled={busy} onClick={() => handoff()}>
          <MessageCircle /> Chat on WhatsApp
        </button>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-links">
          <a href="/#/coa">Certificates of analysis</a>
          <a href="/#/quality">How we test</a>
          <a href="/#/shipping">Shipping</a>
          <a href="/">Full catalogue</a>
        </div>
        TIDEORA supplies research peptides for laboratory use only. Nothing on
        this page is a medical claim, and no product is intended for human or
        veterinary use. Prices are quoted in USD in chat and are confirmed per
        package and per batch. © 2026 TIDEORA.
      </footer>

      <div className="lp-bar">
        <div className="lp-bar-info">
          <small>{filter === "All" ? "All products" : filter}</small>
          <strong>{shown.length} peptides</strong>
        </div>
        <button className="lp-cta" disabled={busy} onClick={() => handoff()}>
          <MessageCircle />
          {busy ? "Opening…" : "Chat on WhatsApp"}
        </button>
      </div>

      {noAgent && (
        <div className="lp-modal-wrap" role="dialog" aria-modal="true">
          <div className="lp-modal">
            <h3>客服正在接入</h3>
            <p>
              Our team is connecting a new WhatsApp line. Please try again in a
              moment — no message was sent.
            </p>
            <div className="lp-modal-actions">
              <button
                className="lp-cta"
                onClick={() => {
                  setNoAgent(false);
                  void handoff();
                }}
              >
                <MessageCircle /> 再试一次
              </button>
            </div>
            <button
              className="lp-modal-close"
              onClick={() => setNoAgent(false)}
            >
              <X size={13} style={{ verticalAlign: "-2px" }} /> Close
            </button>
          </div>
        </div>
      )}

      {fallback && (
        <div className="lp-modal-wrap" role="dialog" aria-modal="true">
          <div className="lp-modal">
            <h3>WhatsApp did not open?</h3>
            <p>
              Some in-app browsers cannot launch the app directly. Copy the
              number below, or open it again — the message is already written
              for you.
            </p>
            <div className="lp-modal-num">
              <span>+{fallback.phone}</span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText("+" + fallback.phone);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="lp-modal-actions">
              <a className="lp-cta" href={fallback.url}>
                <MessageCircle /> Open again
              </a>
            </div>
            <button className="lp-modal-close" onClick={() => setFallback(null)}>
              <X size={13} style={{ verticalAlign: "-2px" }} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
