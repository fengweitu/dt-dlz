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
    <Link to="/" className="brand" aria-label="Aurelis home">
      <span className="brand-emblem">A</span>
      <span className="brand-word">
        AURELIS<small>RESEARCH PEPTIDES</small>
      </span>
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
      <div className="announcement">
        <span>For research use only. Not for human or veterinary use.</span>
        <Link to="/shop">Browse the catalogue ↗</Link>
      </div>
      <header className="header">
        <Brand />
        <nav
          className={menu ? "open" : ""}
          aria-label="Main navigation"
          onClick={() => setMenu(false)}
        >
          {[
            ["/", "Home"],
            ["/shop", "Catalogue"],
            ["/quality", "Specifications & pricing"],
            ["/journal", "Research notes"],
            ["/story", "About AURELIS"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} end>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
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
            <Link to="/quality">Specifications & pricing</Link>
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
          Product names, specifications and USD prices are based on the public
          YuanTid catalog, checked October 23, 2026. Product photos are from
          YuanTid; editorial artwork is by AURELIS. Payment is arranged through
          WhatsApp.
        </div>
        <div className="footer-bottom">
          <span>© 2026 AURELIS. All rights reserved.</span>
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
              ? "Shipping is $15 per order, or complimentary on orders of $299 or more before discounts. Dispatch, tracking and any return or refund are arranged with you on WhatsApp after your order is placed."
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
