import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { gateDrillClick, REPORT_DRILL_AVAILABLE } from './reportDrillGate'

// gateDrillClick — the one place every report reads to decide whether a KPI/bar/row
// gets a click affordance. Regression for the 2026-08-13 finding: the six
// /reports/*/drill|advice endpoints don't exist server-side, so no report may ship a
// clickable bar that 404s.
describe('reportDrillGate', () => {
  it('is off by default (the drill endpoints do not exist yet)', () => {
    expect(REPORT_DRILL_AVAILABLE).toBe(false)
  })

  it('gateDrillClick returns undefined while the flag is off — no handler, no affordance', () => {
    const handler = vi.fn()
    expect(gateDrillClick(handler)).toBeUndefined()
  })
})

// A minimal stand-in for InsightsRow's KpiCard: it only shows a pointer cursor and
// wires onClick when a handler is actually passed — exactly what every report relies
// on when it feeds `gateDrillClick(...)` into `onClick`.
function FakeKpiCard({ onClick }: { onClick?: () => void }) {
  return (
    <div data-testid="kpi" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      KPI
    </div>
  )
}

describe('reportDrillGate — with the flag flipped on (test-override)', () => {
  it('the gated handler still fires unchanged once REPORT_DRILL_AVAILABLE is true', async () => {
    vi.resetModules()
    vi.doMock('./reportDrillGate', () => ({
      REPORT_DRILL_AVAILABLE: true,
      gateDrillClick: (fn: () => void) => fn,
    }))
    const { gateDrillClick: gated } = await import('./reportDrillGate')
    const handler = vi.fn()
    const gatedHandler = gated(handler)
    render(<FakeKpiCard onClick={gatedHandler} />)
    const kpi = screen.getByTestId('kpi')
    expect(kpi).toHaveStyle({ cursor: 'pointer' })
    kpi.click()
    expect(handler).toHaveBeenCalledTimes(1)
    vi.doUnmock('./reportDrillGate')
  })
})
