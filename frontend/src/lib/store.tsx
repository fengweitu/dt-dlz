import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Product, User, CartItem } from "./types";
function readCart(): CartItem[] {
  try {
    const c = JSON.parse(localStorage.getItem("aurelis-cart-v2") || "[]");
    return Array.isArray(c)
      ? c.filter(
          (i) =>
            Number.isInteger(i.id) &&
            Number.isInteger(i.qty) &&
            i.qty > 0 &&
            i.qty <= 99,
        )
      : [];
  } catch {
    return [];
  }
}
function useStoreState() {
  const [products, setProducts] = useState<Product[]>([]),
    [user, setUser] = useState<User | null>(null),
    [favorites, setFavorites] = useState<number[]>([]),
    [cart, setCart] = useState<CartItem[]>(readCart),
    [coupon, setCoupon] = useState(""),
    [cartOpen, setCartOpen] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const notify = useCallback((text: string) => setMessage(text), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(t);
  }, [message]);
  const refreshProducts = useCallback(async () => {
    setProducts(await api<Product[]>("/products"));
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([api<Product[]>("/products"), api<User | null>("/me")])
      .then(async ([p, u]) => {
        const f = u ? await api<number[]>("/favorites") : [];
        if (active) {
          setProducts(p);
          setUser(u);
          setFavorites(f);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("aurelis-cart-v2", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key === "aurelis-cart-v2") setCart(readCart());
    };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, []);
  async function signIn(u: User) {
    setUser(u);
    setFavorites(await api<number[]>("/favorites"));
    setAuthOpen(false);
    notify("Welcome, " + u.name);
  }
  async function signOut() {
    await api("/logout", "POST", {});
    setUser(null);
    setFavorites([]);
    notify("You have been signed out.");
  }
  async function toggleFavorite(id: number) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      await api("/favorites", favorites.includes(id) ? "DELETE" : "POST", {
        product_id: id,
      });
      setFavorites(await api<number[]>("/favorites"));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function addToCart(id: number, qty: number, variant_id: number | null) {
    const p = products.find((p) => p.id === id),
      v = p?.variants.find((v) => v.id === variant_id);
    if (!p || (p.variants.length && !v)) {
      notify("Please select a specification.");
      return false;
    }
    const old = cart.find((i) => i.id === id && i.variant_id === variant_id);
    if ((old?.qty || 0) + qty > Math.min(v?.stock ?? p.stock, 99)) {
      notify("The requested quantity exceeds available stock.");
      return false;
    }
    setCart((current) =>
      old
        ? current.map((i) => (i === old ? { ...i, qty: i.qty + qty } : i))
        : [...current, { id, qty, variant_id }],
    );
    notify("Added to your bag.");
    return true;
  }
  return {
    products,
    user,
    favorites,
    cart,
    coupon,
    cartOpen,
    authOpen,
    message,
    loading,
    error,
    setCart,
    setCoupon,
    setCartOpen,
    setAuthOpen,
    notify,
    refreshProducts,
    signIn,
    signOut,
    toggleFavorite,
    addToCart,
  };
}
const Context = createContext<ReturnType<typeof useStoreState> | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider missing");
  return value;
}
