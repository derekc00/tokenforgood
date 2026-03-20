/** Claude pricing per MTok (millions of tokens), input and output rates. */
const PRICING: Record<'haiku' | 'sonnet' | 'opus', { input: number; output: number }> = {
  haiku:  { input: 0.25,  output: 1.25  },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
}

/**
 * Estimates the dollar cost of a single task run.
 *
 * @param tokenEstimateHigh - Upper-bound token estimate in thousands (e.g. 60 = 60k tokens)
 * @param model - The Claude model that will execute the task
 * @returns Estimated cost in USD, rounded to the nearest cent
 */
export function estimateCost(
  tokenEstimateHigh: number,
  model: 'haiku' | 'sonnet' | 'opus',
): number {
  const p = PRICING[model]
  // Rough split: 40 % input context, 60 % generated output
  const inputTokens  = tokenEstimateHigh * 0.4 // in thousands
  const outputTokens = tokenEstimateHigh * 0.6 // in thousands
  // Pricing is per MTok → divide thousands by 1 000 to get MTok
  const cost = (inputTokens / 1_000) * p.input + (outputTokens / 1_000) * p.output
  return Math.round(cost * 100) / 100
}

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

/**
 * Returns a human-readable cost range string, e.g. "<$0.01" or "$0.03–$0.09".
 *
 * @param tokenEstimateLow  - Lower-bound token estimate in thousands
 * @param tokenEstimateHigh - Upper-bound token estimate in thousands
 * @param model             - The Claude model that will execute the task
 */
export function formatCostEstimate(
  tokenEstimateLow: number,
  tokenEstimateHigh: number,
  model: 'haiku' | 'sonnet' | 'opus',
): string {
  const low  = estimateCost(tokenEstimateLow,  model)
  const high = estimateCost(tokenEstimateHigh, model)

  const fmt = (n: number) =>
    n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`

  if (low === high) return fmt(high)
  return `${fmt(low)}–${fmt(high)}`
}
