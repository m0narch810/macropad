/**
 * Canvas fx (AsciiContour, BrandMark) can't use CSS variables directly -
 * fillStyle needs a concrete color. Resolve the theme's ink (--text) at draw
 * time so the same canvases render white-on-dark and dark-on-light, and
 * watch the <html> theme attributes so static (reduced-motion) frames redraw
 * on a theme switch instead of keeping the old ink.
 */
export function resolveInkRgb(el: Element): string {
  const raw = getComputedStyle(el).getPropertyValue("--text").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  if (hex.length === 3) {
    const [r, g, b] = [...hex].map((c) => parseInt(c + c, 16));
    if (![r, g, b].some(Number.isNaN)) return `${r}, ${g}, ${b}`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (![r, g, b].some(Number.isNaN)) return `${r}, ${g}, ${b}`;
  }
  return "244, 244, 245"; // dark-theme ink fallback
}

export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
  return () => mo.disconnect();
}
