/**
 * lightweight-charts only accepts colors it can parse (e.g. #rgb, rgb(), rgba()).
 * Browsers often serialize getComputedStyle() as lab()/oklch(), which the chart rejects.
 */

const FALLBACK_LIGHT = {
  textColor: "#252525",
  gridColor: "rgba(0, 0, 0, 0.09)",
} as const;

const FALLBACK_DARK = {
  textColor: "#fafafa",
  gridColor: "rgba(255, 255, 255, 0.08)",
} as const;

function probeComputedColor(doc: Document, cssColor: string): string {
  const probe = doc.createElement("span");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;color:" + cssColor;
  doc.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/**
 * Convert any color the canvas accepts into rgba() for lightweight-charts.
 */
function canvasToRgba(doc: Document, cssColor: string): string | null {
  const canvas = doc.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.fillStyle = cssColor;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return null;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  } catch {
    return null;
  }
}

function isLikelyChartSafe(color: string): boolean {
  const c = color.trim();
  if (/^rgba?\(\s*\d/.test(c)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return true;
  return false;
}

export type ChartThemeHint = "light" | "dark" | undefined;

export function colorsForLightweightCharts(doc: Document, theme: ChartThemeHint) {
  const fb = theme === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT;

  const rawText = probeComputedColor(doc, "var(--foreground)");
  const rawGrid = probeComputedColor(doc, "color-mix(in oklch, var(--border) 60%, transparent)");

  const textColor =
    (isLikelyChartSafe(rawText) ? rawText.trim() : null) ?? canvasToRgba(doc, rawText) ?? fb.textColor;

  const gridColor =
    (isLikelyChartSafe(rawGrid) ? rawGrid.trim() : null) ?? canvasToRgba(doc, rawGrid) ?? fb.gridColor;

  return { textColor, gridColor };
}
