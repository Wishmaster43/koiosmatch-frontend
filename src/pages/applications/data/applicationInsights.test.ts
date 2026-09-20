// Regression test for GETALLEN-1: computeAvgScore must render through the
// shared locale-aware formatter, never a hand-built `Math.round(...) + '%'`.
import { describe, expect, it } from 'vitest'
import { computeAvgScore } from './applicationInsights'
import type { Application } from '@/types/application'

const app = (score: number | null, bucket: string = 'active'): Application =>
  ({ score, bucket } as unknown as Application)

describe('computeAvgScore', () => {
  it('renders the average score through the shared locale formatter (nl-NL default)', () => {
    expect(computeAvgScore([app(80), app(90)])).toBe('85%')
  })

  it('uses the given locale (en-GB uses a period, no fraction digits for a whole number)', () => {
    expect(computeAvgScore([app(80), app(90)], 'en-GB')).toBe('85%')
  })

  it('excludes rejected applications and non-numeric scores from the average', () => {
    expect(computeAvgScore([app(100, 'rejected'), app(null as unknown as number), app(60)])).toBe('60%')
  })

  it('falls back to the house dash when nothing is scored', () => {
    expect(computeAvgScore([])).toBe('—')
  })
})
