import { useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useStore, StoreProvider } from "./lib/store";
import { Layout } from "./components/Layout";
import { Empty } from "./components/Common";
import { Home } from "./pages/Home";
import { Shop, ProductPage } from "./pages/Catalog";
import { Journal, Quality, Story, Privacy } from "./pages/Information";
import { Checkout } from "./pages/Checkout";
import { Account } from "./pages/Account";
import { Admin } from "./pages/Admin";
const titles: Record<string, string> = {
  "/shop": "The catalogue",
  "/quality": "Specifications & pricing",
  "/story": "About us",
  "/journal": "Research notes",
  "/privacy": "Privacy policy",
  "/account": "My account",
  "/checkout": "Checkout",
};
function StoreRoutes() {
  const s = useStore(),
    location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    s.setCartOpen(false);
    const page =
      titles[location.pathname] ||
      (location.pathname.startsWith("/product/")
        ? "The catalogue"
        : location.pathname.startsWith("/journal/")
          ? "Research notes"
          : "Research Peptides");
    document.title = page + " | AURELIS";
  }, [location.pathname]);
  if (s.loading) return <div className="loading">Loading the catalogue…</div>;
  if (s.error)
    return (
      <Empty title="Unable to connect to the store.">
        <p>{s.error}</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Try again
        </button>
      </Empty>
    );
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/story" element={<Story />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/:id" element={<Journal />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Empty title="Page not found." />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <StoreRoutes />
      </HashRouter>
    </StoreProvider>
  );
}
