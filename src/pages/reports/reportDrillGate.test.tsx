import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { gateDrillClick, REPORT_DRILL_AVAILABLE } from './reportDrillGate'
import type { DrillableReport } from './reportDrillGate'

// gateDrillClick — the one place every report reads to decide whether a KPI/bar/row
// gets a click affordance. RAPPORTEN-DANNY10-1 shrank the vocabulary to the nine
// surviving reports; every one of them ships with a live, verified drill contract
// (axis drills for the fase-1 reports, the per-KPI drill for whatsapp), so today
// the whole map reads true — the gate mechanism itself stays covered below for
// the day a new report lands before its drill route does.
describe('reportDrillGate', () => {
  it('every surviving report has its drill flag on', () => {
    for (const [report, on] of Object.entries(REPORT_DRILL_AVAILABLE)) {
      expect(on, `${report} must carry a live drill contract`).toBe(true)
    }
  })

  it('carries no retired report id', () => {
    for (const retired of ['flow', 'recruiters', 'intakes', 'ai', 'workflows', 'usage', 'contacts', 'locations', 'departments']) {
      expect(retired in REPORT_DRILL_AVAILABLE).toBe(false)
    }
  })

  it('gateDrillClick returns the handler unchanged for an available report', () => {
    const handler = vi.fn()
    expect(gateDrillClick('matches', handler)).toBe(handler)
    expect(gateDrillClick('whatsapp', handler)).toBe(handler)
  })
})

// A minimal stand-in for InsightsRow's KpiCard: it only shows a pointer cursor and
// wires onClick when a handler is actually passed — exactly what every report relies
// on when it feeds `gateDrillClick(report, ...)` into `onClick`.
function FakeKpiCard({ onClick }: { onClick?: () => void }) {
  return (
    <div data-testid="kpi" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      KPI
    </div>
  )
}

describe('reportDrillGate — wired into a click affordance', () => {
  // The false branch has no natural member today (see above) — flip one flag for
  // the duration of the test and restore it, so the mechanism stays pinned.
  afterEach(() => { REPORT_DRILL_AVAILABLE.whatsapp = true })

  it('an available report gets a real onClick + pointer cursor and the handler fires', async () => {
    const handler = vi.fn()
    render(<FakeKpiCard onClick={gateDrillClick('vacancies', handler)} />)
    const kpi = screen.getByTestId('kpi')
    expect(kpi).toHaveStyle({ cursor: 'pointer' })
    kpi.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('a gated report gets no onClick and no pointer cursor', () => {
    const handler = vi.fn()
    ;(REPORT_DRILL_AVAILABLE as Record<DrillableReport, boolean>).whatsapp = false
    render(<FakeKpiCard onClick={gateDrillClick('whatsapp', handler)} />)
    const kpi = screen.getByTestId('kpi')
    expect(kpi).toHaveStyle({ cursor: 'default' })
    kpi.click()
    expect(handler).not.toHaveBeenCalled()
  })
})
