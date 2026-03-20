/**
 * Returns a human-readable token-range label for display in the UI.
 *
 * @param low  - Lower-bound estimate in thousands
 * @param high - Upper-bound estimate in thousands
 * @returns A compact string such as "~15k tokens" or "~20k–60k tokens"
 */
export function formatTokenEstimate(low: number, high: number): string {
  if (high < 20) return `~${high}k tokens`
  if (high < 50) return `~${low}k–${high}k tokens`
  return `~${high}k tokens`
}
