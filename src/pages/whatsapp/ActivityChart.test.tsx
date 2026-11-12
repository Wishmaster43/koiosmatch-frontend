/**
 * ActivityChart — LANE-B regression: the chart renders (and its axis/tooltip
 * date formatting resolves) under the same flat react-i18next mock the other
 * WhatsApp chart tests use, without a mocked `i18n` on useTranslation().
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityChart from './ActivityChart'

// Capture the formatters the chart hands to recharts (real layout does not exist in jsdom).
const captured: { tick?: (v: string) => string; label?: (v: unknown) => string } = {}
vi.mock('recharts', () => {
  const Null = () => null
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    AreaChart: Box, ResponsiveContainer: Box, Area: Null, YAxis: Null, CartesianGrid: Null, Legend: Null,
    XAxis: (p: { tickFormatter: (v: string) => string }) => { captured.tick = p.tickFormatter; return null },
    Tooltip: (p: { labelFormatter: (v: unknown) => string }) => { captured.label = p.labelFormatter; return null },
  }
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// formatters imports `@/lib/datetime` (i18n bootstrap), which the flat react-i18next mock cannot carry.
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

describe('ActivityChart', () => {
  it('renders the chart title for a non-empty activity series', () => {
    render(<ActivityChart data={[
      { date: '2026-08-24', inbound: 3, outbound: 4 },
      { date: '2026-08-25', inbound: 1, outbound: 2 },
    ]} />)
    expect(screen.getByText('chartTitle')).toBeInTheDocument()
  })

  it('formats the axis tick as DD-MM and the tooltip label as DD-MM-YYYY', () => {
    render(<ActivityChart data={[{ date: '2026-08-24', inbound: 1, outbound: 2 }]} />)
    expect(captured.tick?.('2026-08-24')).toBe('24-08')
    expect(captured.label?.('2026-08-24')).toBe('24-08-2026')
  })

  it('shows the loading state instead of the chart', () => {
    render(<ActivityChart data={[]} loading />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })
})
