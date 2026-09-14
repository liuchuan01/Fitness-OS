import { useEffect, useState } from "react";

export function useBodyMotion() {
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const visibility = () => setVisible(!document.hidden);
    const preference = () => setReducedMotion(query?.matches ?? false);
    document.addEventListener("visibilitychange", visibility);
    query?.addEventListener("change", preference);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      query?.removeEventListener("change", preference);
    };
  }, []);
  return { visible, reducedMotion, dragging, setDragging };
}
