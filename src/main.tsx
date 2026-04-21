import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Remove Lovable badge if injected
const removeLovableBadge = () => {
  const badge = document.querySelector('[id^="lovable-badge"]');
  if (badge) badge.remove();
};
const observer = new MutationObserver(removeLovableBadge);
observer.observe(document.body, { childList: true, subtree: true });
removeLovableBadge();

createRoot(document.getElementById("root")!).render(<App />);
