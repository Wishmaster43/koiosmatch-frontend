/**
 * reportWindowLabel — joins two independently formatted dates with an en dash
 * (a data separator, §5), regardless of which envelope path fed the dates in.
 */
import { describe, it, expect } from 'vitest'
import { reportWindowLabel } from './reportWindowLabel'

describe('reportWindowLabel', () => {
  it('joins the two formatted dates with an en dash', () => {
    const formatDate = (d: string | undefined) => (d ? `fmt(${d})` : '—')
    expect(reportWindowLabel(formatDate, '2026-08-01', '2026-08-31')).toBe('fmt(2026-08-01) – fmt(2026-08-31)')
  })

  it('formats each side independently, even when one side is undefined', () => {
    const formatDate = (d: string | undefined) => (d ? `fmt(${d})` : '—')
    expect(reportWindowLabel(formatDate, undefined, '2026-08-31')).toBe('— – fmt(2026-08-31)')
  })
})
