/**
 * Map RF predict_proba indices to direction labels (sklearn uses sorted class order: -1, 0, 1).
 */
export const DIRECTION_CLASS_LABELS = ["Down (−1)", "Flat (0)", "Up (+1)"] as const;

export function probaRows(proba: number[]): { label: string; p: number }[] {
  const labels =
    proba.length === 3
      ? DIRECTION_CLASS_LABELS
      : proba.map((_, i) => `Class ${i}`);
  return proba.map((p, i) => ({
    label: labels[i] ?? `Class ${i}`,
    p: Number.isFinite(p) ? p : 0,
  }));
}

/** Shannon entropy in bits; higher ⇒ more spread / less decisive (0 = one class certain). */
export function distributionEntropy(proba: number[]): number {
  let h = 0;
  for (const x of proba) {
    if (x > 1e-12) h -= x * Math.log2(x);
  }
  return h;
}

export function maxProba(proba: number[]): number {
  return proba.length ? Math.max(...proba) : 0;
}
