import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Landing, isLandingPath } from "./lp/Landing";
import { Admin, isAdminPath } from "./lp/Admin";
import { installWaRouter } from "./lib/waLink";
import "./style.css";
import "./brand.css";
import "./react.css";
import "./font.css";

// Two surfaces live outside the HashRouter on purpose:
//   /lp/*      ad landing page — clean URL for ads, no hash, no store chrome
//   /wh-admin  WhatsApp number pool admin — not linked from the storefront
// Everything else falls through to the original storefront.
const path = window.location.pathname;

// Storefront WhatsApp links carry a single hard-coded number; this routes each
// click through the number pool so the admin can see per-agent traffic.
installWaRouter();

function Root() {
  if (isAdminPath(path)) return <Admin />;
  if (isLandingPath(path)) return <Landing />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
