import { useEffect } from "react";

/** navigator.vibrate is phone-only (desktop browsers and iOS Safari lack it), so the feature
 * check doubles as the platform check without a separate device sniff. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Injects a <style> once per document, keyed by id, so remounts (StrictMode, reconnects) never
 * duplicate the tag. */
export function useInjectedStyles(id: string, css: string): void {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }, [id, css]);
}
