import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Remove Lovable badge if injected ──────────────────────────
const removeLovableBadge = () => {
  const badge = document.querySelector('[id^="lovable-badge"]');
  if (badge) badge.remove();
};
const observer = new MutationObserver(removeLovableBadge);
observer.observe(document.body, { childList: true, subtree: true });
removeLovableBadge();

// ── Block DevTools (F12, right-click inspect, keyboard shortcuts) ──
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
  // F12
  if (e.key === "F12") { e.preventDefault(); return; }
  // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / Ctrl+U
  if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.ctrlKey && e.key === "U") { e.preventDefault(); return; }
  // Ctrl+S (view source shortcut)
  if (e.ctrlKey && e.key === "s") { e.preventDefault(); return; }
});

createRoot(document.getElementById("root")!).render(<App />);
