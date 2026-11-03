import { useEffect, useState } from "react";
import { MessageCircle, ArrowUp } from "lucide-react";
import { peekWaTarget, type WaPeek } from "../lib/waLink";
import { whatsappUrl } from "../lib/api";

/** Refresh the label every minute, and whenever the tab comes back. */
const REFRESH_MS = 60_000;

function pretty(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  // +86 130 1392 5997 reads better than a 13-digit run in a narrow card.
  if (d.length === 13 && d.startsWith("86")) {
    return `+86 ${d.slice(2, 5)} ${d.slice(5, 9)} ${d.slice(9)}`;
  }
  return "+" + d;
}

export function ContactFloat() {
  const [agent, setAgent] = useState<WaPeek | null>(null),
    [loaded, setLoaded] = useState(false),
    [scrolled, setScrolled] = useState(false);

  // The number shown here must be the one the pool is handing out right now.
  // It used to come from a hard-coded constant in lib/api.ts, so changing an
  // agent in /wh-admin never updated the label on the site.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const target = await peekWaTarget();
      if (!alive) return;
      setAgent(target);
      setLoaded(true);
    };
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const label = agent
    ? pretty(agent.phone)
    : loaded
      ? "在线咨询"
      : "…";
  // Always render a real link: if the pool is momentarily unreachable the click
  // router still resolves it, and only shows the "retry" card when there is
  // genuinely no enabled number. A dead <button> would lose the lead.
  const text = "Hello, I have a question about TIDEORA research peptides.";
  const href = agent
    ? `https://wa.me/${agent.phone}?text=${encodeURIComponent(text)}`
    : whatsappUrl(text);

  const inner = (
    <>
      <span className="contact-card">
        <small>WhatsApp</small>
        <strong>{label}</strong>
      </span>
      <span className="contact-icon" aria-hidden="true">
        <MessageCircle />
      </span>
    </>
  );

  return (
    <div className={"contact-float" + (scrolled ? " scrolled" : "")}>
      <a
        className="contact-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={agent?.name ? `客服：${agent.name}` : "WhatsApp"}
        aria-label={`Message us on WhatsApp at ${label}`}
      >
        {inner}
      </a>
      <button
        className="contact-top"
        aria-label="Back to top"
        hidden={!scrolled}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp />
      </button>
    </div>
  );
}
