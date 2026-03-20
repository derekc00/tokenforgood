import { describe, it, expect } from 'vitest'
import { estimateCost, formatTokenEstimate } from '@/lib/templates/token-estimate'

// ---------------------------------------------------------------------------
// estimateCost
// ---------------------------------------------------------------------------

describe('estimateCost', () => {
  it('haiku is cheaper than sonnet for the same token count', () => {
    const haiku = estimateCost(60, 'haiku')
    const sonnet = estimateCost(60, 'sonnet')
    expect(haiku).toBeLessThan(sonnet)
  })

  it('sonnet is cheaper than opus for the same token count', () => {
    const sonnet = estimateCost(60, 'sonnet')
    const opus = estimateCost(60, 'opus')
    expect(sonnet).toBeLessThan(opus)
  })

  it('returns 0 for zero tokens', () => {
    expect(estimateCost(0, 'haiku')).toBe(0)
    expect(estimateCost(0, 'sonnet')).toBe(0)
    expect(estimateCost(0, 'opus')).toBe(0)
  })

  it('returns a finite number (not NaN, not Infinity)', () => {
    const result = estimateCost(100, 'sonnet')
    expect(Number.isFinite(result)).toBe(true)
    expect(Number.isNaN(result)).toBe(false)
  })

  it('50k tokens with opus costs more than $1', () => {
    // At opus pricing: input=$15/MTok, output=$75/MTok
    // 50k tokens → 0.05 MTok total
    // cost = (0.05 * 0.4 * 15) + (0.05 * 0.6 * 75) = 0.30 + 2.25 = $2.55
    const cost = estimateCost(50, 'opus')
    expect(cost).toBeGreaterThan(1)
  })

  it('rounds to the nearest cent', () => {
    const result = estimateCost(1, 'sonnet')
    // Verify it's a number with at most 2 decimal places
    const rounded = Math.round(result * 100) / 100
    expect(result).toBe(rounded)
  })

  it('matches manual calculation for sonnet at 100k tokens', () => {
    // 100k tokens → 100 thousands
    // input = 100 * 0.4 = 40 thousands → 0.04 MTok → 0.04 * 3.00 = $0.12
    // output = 100 * 0.6 = 60 thousands → 0.06 MTok → 0.06 * 15.00 = $0.90
    // total = $1.02
    expect(estimateCost(100, 'sonnet')).toBe(1.02)
  })
})

// ---------------------------------------------------------------------------
// formatTokenEstimate
// ---------------------------------------------------------------------------

describe('formatTokenEstimate', () => {
  it('returns ~Nk tokens format when high < 20', () => {
    // high = 10
    expect(formatTokenEstimate(5, 10)).toBe('~10k tokens')
  })

  it('returns the high value in ~Nk tokens format when high is exactly 19', () => {
    expect(formatTokenEstimate(10, 19)).toBe('~19k tokens')
  })

  it('returns ~lowk–highk tokens range format when 20 <= high < 50', () => {
    // high = 30
    expect(formatTokenEstimate(20, 30)).toBe('~20k–30k tokens')
  })

  it('returns ~Nk tokens format when high is exactly 20 but range differs', () => {
    expect(formatTokenEstimate(10, 20)).toBe('~10k–20k tokens')
  })

  it('returns ~Nk tokens format when high >= 50', () => {
    expect(formatTokenEstimate(30, 60)).toBe('~60k tokens')
  })

  it('returns ~Nk tokens format when high is exactly 50', () => {
    expect(formatTokenEstimate(30, 50)).toBe('~50k tokens')
  })

  it('handles equal low and high values', () => {
    // high = 10 → small format
    expect(formatTokenEstimate(10, 10)).toBe('~10k tokens')
    // high = 30 → medium format
    expect(formatTokenEstimate(30, 30)).toBe('~30k–30k tokens')
    // high = 60 → large format
    expect(formatTokenEstimate(60, 60)).toBe('~60k tokens')
  })
})
