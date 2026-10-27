import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Search, UserRound, ShoppingBag, Menu } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { Modal } from "./Common";
import { AuthDialog } from "./AuthDialog";
import { CartDrawer } from "./CartDrawer";
import { ContactFloat } from "./ContactFloat";
export function Brand() {
  return (
    <Link
      to="/"
      className="brand"
      aria-label="Tideora home"
      style={{ background: "#ffffff", borderRadius: 8, padding: "6px 10px" }}
    >
      <img
        src="/images/tideora-logo-horizontal.jpg"
        alt="Tideora Peptides and Biotech"
        style={{ height: 48, width: "auto", maxWidth: 260, display: "block" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </Link>
  );
}
export function Layout() {
  const s = useStore(),
    navigate = useNavigate(),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [policy, setPolicy] = useState("");
  async function subscribe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api("/subscribe", "POST", Object.fromEntries(new FormData(f)));
      f.reset();
      s.notify("You're on the list for specification and price updates.");
    } catch (e) {
      s.notify((e as Error).message);
    }
  }
  return (
    <>
      {/* Nav underline distance: site CSS puts the active underline at
          bottom:24-28px, too close to the text. Move it down to near the
          bottom edge of the header so it sits further from the text. */}
      <style>{`.header nav a.active:after{bottom:10px !important;}`}</style>
      <div className="announcement">
        <span>For research use only. Not for human or veterinary use.</span>
        <span>Free shipping over $500</span>
        <Link to="/shop">Browse the catalogue ↗</Link>
      </div>
      <header
        className="header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#ffffff",
          boxShadow: "0 2px 12px rgba(15,46,38,0.12)",
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <Brand />
        <nav
          className={menu ? "open" : ""}
          aria-label="Main navigation"
          onClick={() => setMenu(false)}
          style={{ gap: 8 }}
        >
          {[
            ["/", "Home"],
            ["/shop", "Catalogue"],
            ["/coa", "COA & Testing"],
            ["/quality", "Quality"],
            ["/faq", "FAQ"],
            ["/shipping", "Shipping"],
            ["/journal", "Research notes"],
            ["/story", "About"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end
              style={({ isActive }) => ({
                fontSize: 17,
                fontWeight: 700,
                padding: "12px 16px",
                color: isActive ? "#0f2e26" : "#222222",
                // Do not add a text underline here: the site CSS already draws
                // one line under the active nav link via .header nav a.active:after.
                // Adding underline here created a second line.
                textDecoration: "none",
                whiteSpace: "nowrap",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            to="/coa"
            className="btn"
            style={{
              background: "#c9a86a",
              color: "#0f2e26",
              fontWeight: 700,
              padding: "10px 16px",
              whiteSpace: "nowrap",
            }}
          >
            Certificates (COA)
          </Link>
          <button
            className="icon-button"
            aria-label="Search products"
            onClick={() => setSearch(true)}
          >
            <Search />
          </button>
          <button
            className="icon-button"
            aria-label="My account"
            onClick={() => navigate("/account")}
          >
            <UserRound />
          </button>
          <button
            className="icon-button bag"
            aria-label="Shopping bag"
            onClick={() => s.setCartOpen(true)}
          >
            <ShoppingBag />
            <span id="cart-count">{s.cart.reduce((n, i) => n + i.qty, 0)}</span>
          </button>
          <button
            className="icon-button menu-toggle"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer>
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              Research peptides, by the vial.
              <br />
              Names, specifications and USD prices in one place.
            </p>
            <span className="footer-location">UNITED STATES · USD</span>
          </div>
          <div>
            <h4>Catalogue</h4>
            <Link to="/shop">All peptides</Link>
            <Link to="/shop?category=GLP+Series">GLP series</Link>
            <Link to="/shop?category=Single+Peptides">Single peptides</Link>
            <Link to="/shop?category=Peptide+Blends">Peptide blends</Link>
            <Link to="/coa">Certificates (COA) &amp; testing</Link>
            <Link to="/quality">Specifications & pricing</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/shipping">Shipping &amp; returns</Link>
          </div>
          <div>
            <h4>Ordering</h4>
            <Link to="/account">My orders</Link>
            <Link to="/journal/2">How to order</Link>
            <button onClick={() => setPolicy("Shipping & returns")}>
              Shipping & returns
            </button>
            <button onClick={() => setPolicy("Contact us")}>Contact us</button>
          </div>
          <div className="newsletter">
            <h4>New specifications, by email.</h4>
            <p>
              An occasional note when products, package sizes or prices change.
            </p>
            <form onSubmit={subscribe}>
              <input
                name="email"
                type="email"
                required
                placeholder="Your email address"
                aria-label="Email for updates"
              />
              <button aria-label="Subscribe">↗</button>
            </form>
            <small>
              By subscribing, you agree to our{" "}
              <Link to="/privacy">privacy policy</Link>.
            </small>
          </div>
        </div>
        <div className="footer-disclaimer">
          Product names, specifications and USD prices are listed by TIDEORA,
          checked October 23, 2026. Payment is arranged through WhatsApp.
          Batch COA is available on request via WhatsApp.
        </div>
        <div className="footer-bottom">
          <span>© 2026 TIDEORA. All rights reserved.</span>
          <span>Research use only. No medical claims.</span>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/admin">Merchant portal</Link>
        </div>
      </footer>
      {s.authOpen && <AuthDialog />}
      {s.cartOpen && <CartDrawer />}
      {search && (
        <Modal title="Search the catalogue." onClose={() => setSearch(false)}>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              setSearch(false);
              navigate("/shop?q=" + encodeURIComponent(String(q)));
            }}
          >
            <input
              name="q"
              required
              autoFocus
              aria-label="Search products"
              placeholder="Peptide name or code, e.g. BPC-157"
            />
            <button className="btn">Search</button>
          </form>
        </Modal>
      )}
      {policy && (
        <Modal title={policy} onClose={() => setPolicy("")}>
          <p>
            {policy === "Shipping & returns"
              ? "Shipping is $15 per order, or complimentary on orders of $500 or more. Dispatch, tracking and any return or refund are arranged with you on WhatsApp after your order is placed."
              : "Use the WhatsApp button on any page to reach us, or select Pay via WhatsApp in your order history to message us with your order summary already filled in. We reply during business hours."}
          </p>
        </Modal>
      )}
      <ContactFloat />
      <div id="toast" role="status" className={s.message ? "show" : ""}>
        {s.message}
      </div>
    </>
  );
}
