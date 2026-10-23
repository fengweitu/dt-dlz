import { useEffect, useState } from "react";
import { MessageCircle, ArrowUp } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
type Contact = { whatsapp_number: string; whatsapp_url: string };
export function ContactFloat() {
  const s = useStore(),
    [contact, setContact] = useState<Contact | null>(null),
    [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let active = true;
    api<Contact>("/contact")
      .then((c) => active && setContact(c))
      .catch(
        () => active && setContact({ whatsapp_number: "", whatsapp_url: "" }),
      );
    return () => {
      active = false;
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
  if (!contact) return null;
  const configured = Boolean(contact.whatsapp_url),
    label = configured ? "+" + contact.whatsapp_number : "Not configured yet",
    inner = (
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
      {configured ? (
        <a
          className="contact-link"
          href={contact.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={"Message us on WhatsApp at " + label}
        >
          {inner}
        </a>
      ) : (
        <button
          className="contact-link"
          aria-label="WhatsApp contact is not configured yet"
          onClick={() =>
            s.notify(
              "WhatsApp contact is not configured yet. Add a number to store-config.json.",
            )
          }
        >
          {inner}
        </button>
      )}
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
