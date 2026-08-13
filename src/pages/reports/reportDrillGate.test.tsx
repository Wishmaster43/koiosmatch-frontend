import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { gateDrillClick, REPORT_DRILL_AVAILABLE } from './reportDrillGate'

// gateDrillClick — the one place every report reads to decide whether a KPI/bar/row
// gets a click affordance. Regression for REPORTS-DRILL-1 (2026-08-13): flow/matches/
// recruiters/vacancies now have a live /reports/{r}/drill|advice contract and must be
// clickable; intakes/outreach/sources have no matching endpoint yet and must stay off.
describe('reportDrillGate', () => {
  it('is on for the four reports with a shipped drill contract', () => {
    expect(REPORT_DRILL_AVAILABLE.flow).toBe(true)
    expect(REPORT_DRILL_AVAILABLE.matches).toBe(true)
    expect(REPORT_DRILL_AVAILABLE.recruiters).toBe(true)
    expect(REPORT_DRILL_AVAILABLE.vacancies).toBe(true)
  })

  it('stays off for the reports without a drill endpoint yet', () => {
    expect(REPORT_DRILL_AVAILABLE.intakes).toBe(false)
    expect(REPORT_DRILL_AVAILABLE.outreach).toBe(false)
    expect(REPORT_DRILL_AVAILABLE.sources).toBe(false)
  })

  it('gateDrillClick returns the handler unchanged for an available report', () => {
    const handler = vi.fn()
    expect(gateDrillClick('flow', handler)).toBe(handler)
  })

  it('gateDrillClick returns undefined for a report without a drill endpoint', () => {
    const handler = vi.fn()
    expect(gateDrillClick('intakes', handler)).toBeUndefined()
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
    render(<FakeKpiCard onClick={gateDrillClick('sources', handler)} />)
    const kpi = screen.getByTestId('kpi')
    expect(kpi).toHaveStyle({ cursor: 'default' })
    kpi.click()
    expect(handler).not.toHaveBeenCalled()
  })
})
