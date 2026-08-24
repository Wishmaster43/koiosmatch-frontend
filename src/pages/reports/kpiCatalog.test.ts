import { describe, it, expect } from 'vitest'
import {
  getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards,
  REPORT_KPI_SCOPE_IDS, CUSTOMERS_SIGNAL_LABEL_KEYS,
} from './kpiCatalog'

// REPORTS-KPI-SPARES coverage on the SURVIVING scopes (RAPPORTEN-DANNY10-1
// retired intakes/ai/workflows with their pages): outreach/matches/whatsapp each
// carry a real catalogue — the settings screen picker (ReportKpiSettings) reads
// these functions directly, so covering them here proves the picker works
// without mounting the whole settings screen.
// The customers kpi-drill wire enum (CustomersReport.tsx) and the signal label
// map here describe the SAME nine keys — a future divergence must fail loudly
// instead of silently rendering an undrillable or unlabeled card.
describe('kpiCatalog — customers signal keys stay in lockstep with the drill enum', () => {
  it('CUSTOMERS_SIGNAL_LABEL_KEYS covers exactly the nine kpi-drill enum keys', () => {
    expect(Object.keys(CUSTOMERS_SIGNAL_LABEL_KEYS).sort()).toEqual([
      'contract_ending', 'customers_without_applications', 'customers_without_vacancies',
      'departments_without_placement', 'matches_stopped_early', 'no_contact',
      'price_agreement_ending', 'task_overdue', 'vacancy_stale',
    ])
  })
})

describe('kpiCatalog — spare cards on surviving scopes', () => {
  it('outreach catalogue offers its spare keys', () => {
    const catalogKeys = getReportKpiCatalog('outreach').map(c => c.key)
    for (const key of ['topStatus', 'topOutcome', 'campaignsCount', 'channelsUsed', 'assigneesCount']) {
      expect(catalogKeys).toContain(key)
    }
  })

  it.each(['outreach', 'matches', 'whatsapp'] as const)(
    '%s default order stays exactly nine keys once spares are appended',
    (scopeId) => {
      expect(getReportKpiDefaultOrder(scopeId)).toHaveLength(9)
    },
  )

  it('outreach and matches report real spare cards to the settings screen', () => {
    expect(reportHasSpareKpiCards('outreach')).toBe(true)
    expect(reportHasSpareKpiCards('matches')).toBe(true)
  })

  // RAPPORTEN-WHATSAPP-FE-1: the whatsapp strip is exactly the nine pinned
  // contract keys, in contract order — no spares yet.
  it('whatsapp default order is exactly the nine contract keys', () => {
    expect(getReportKpiDefaultOrder('whatsapp')).toEqual([
      'conversationsTotal', 'active7d', 'newInPeriod', 'inboundInPeriod',
      'outboundInPeriod', 'appEchoesInPeriod', 'escalationsOpen',
      'unansweredOverWindow', 'avgFirstResponseMinutes',
    ])
  })

  // RAPPORTEN-DANNY10-1: the settings screen offers ONLY surviving scopes —
  // a retired scope resurfacing here would put a dead tab back in Settings.
  it('the scope list carries no retired report id', () => {
    for (const retired of ['flow', 'recruiters', 'accountmanagers', 'contacts', 'locations', 'departments', 'usage', 'ai', 'workflows', 'intakes']) {
      expect(REPORT_KPI_SCOPE_IDS as readonly string[]).not.toContain(retired)
    }
  })

  it('no catalogue offers the same key twice', () => {
    for (const scopeId of REPORT_KPI_SCOPE_IDS) {
      const keys = getReportKpiCatalog(scopeId).map(c => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
