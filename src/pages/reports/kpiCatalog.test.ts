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
  it.each(['outreach', 'matches', 'whatsapp'] as const)(
    '%s default order stays exactly nine keys once spares are appended',
    (scopeId) => {
      expect(getReportKpiDefaultOrder(scopeId)).toHaveLength(9)
    },
  )

  // KPI-MATCHES-1 (27-08): matches moved to the server's own nine-key kpis[]
  // suite — the four spare cards retired with the ad-hoc strip, so the settings
  // screen must now be honest about having nothing extra to offer. Vacancies
  // still carries real spares and keeps that path covered below.
  it('matches no longer reports spare cards after the server-suite flip', () => {
    expect(reportHasSpareKpiCards('matches')).toBe(false)
  })
  // Both opp+vac moved to server suites (28-08) — LEADS is the one scope left
  // with spares (catalog 8 > default 5, measured), so it carries the spare-path pin.
  it('leads still reports real spare cards to the settings screen', () => {
    expect(reportHasSpareKpiCards('leads')).toBe(true)
  })
  it('vacancies default is the backend four-card list, so the other catalogue cards are spares', () => {
    expect(getReportKpiDefaultOrder('vacancies')).toEqual(['total', 'open', 'filled', 'fill_rate'])
    expect(reportHasSpareKpiCards('vacancies')).toBe(true)
  })

  // CMBE K-191: outreach moved to the server's own nine-card kpis[] suite —
  // no spares, exactly the nine contract keys, in contract order.
  it('outreach default order is exactly the nine contract keys', () => {
    expect(getReportKpiDefaultOrder('outreach')).toEqual([
      'total_targets', 'open_todo', 'called_in_period', 'reached', 'not_reached',
      'conversion_pct', 'campaigns_active', 'campaigns_done_in_period', 'due_today',
    ])
    expect(reportHasSpareKpiCards('outreach')).toBe(false)
  })

  // RAPPORTEN-WHATSAPP-FE-1: the whatsapp strip is exactly the nine pinned
  // contract keys, in contract order — no spares yet.
  it('whatsapp default order is exactly the nine contract keys', () => {
    expect(getReportKpiDefaultOrder('whatsapp')).toEqual([
      'conversations_total', 'active_7d', 'new_in_period', 'inbound_in_period',
      'outbound_in_period', 'app_echoes_in_period', 'escalations_open',
      'unanswered_over_window', 'avg_first_response_minutes',
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

// REPORT-KPI-CATALOG-DRIFT-1: static fixture copied from koiosmatch-api config/report_kpis.php
// (`available` keys and `default` lists per fixed scope, 13-11). The FE catalogue must use
// exactly the backend snake_case keys; a key the backend offers that the FE has no card for
// yet is listed in NOT_YET_RENDERED so the gap stays visible instead of silent.
const BACKEND_KPIS: Record<string, { available: string[]; default: string[] }> = {
  candidates: {
    available: ['no_followup', 'status_stale', 'no_cv', 'document_expiring', 'availability_due', 'no_contact', 'active_conversations', 'inflow', 'outflow'],
    default: ['inflow', 'outflow', 'no_followup', 'status_stale', 'no_cv', 'document_expiring', 'availability_due', 'no_contact', 'active_conversations'],
  },
  applications: {
    available: ['total', 'new', 'active', 'matched', 'rejected', 'conversion_pct', 'avg_days_to_match', 'too_long_in_stage', 'missing_appointment', 'stage_dwell'],
    default: ['total', 'new', 'active', 'matched', 'rejected', 'conversion_pct', 'avg_days_to_match', 'too_long_in_stage', 'missing_appointment'],
  },
  customers: {
    available: ['contract_ending', 'no_contact', 'task_overdue', 'price_agreement_ending', 'vacancy_stale', 'departments_without_placement', 'customers_without_vacancies', 'customers_without_applications', 'matches_stopped_early'],
    default: ['contract_ending', 'no_contact', 'task_overdue', 'price_agreement_ending', 'vacancy_stale', 'departments_without_placement', 'customers_without_vacancies', 'customers_without_applications', 'matches_stopped_early'],
  },
  vacancies: {
    available: ['total', 'open', 'filled', 'fill_rate', 'stale_online', 'long_concept', 'no_matches', 'closing_soon', 'customers_count', 'without_advice', 'advice_stale', 'verdict_distribution'],
    default: ['total', 'open', 'filled', 'fill_rate'],
  },
  opportunities: {
    available: ['total', 'open', 'won', 'lost', 'win_rate', 'open_value', 'stale', 'closing_soon', 'overdue'],
    default: ['total', 'open', 'won', 'win_rate'],
  },
  tasks: {
    available: ['total', 'open', 'overdue', 'done_in_period', 'created_in_period', 'due_today', 'due_this_week', 'without_assignee', 'avg_completion_days'],
    default: ['total', 'open', 'overdue', 'done_in_period', 'created_in_period', 'due_today', 'due_this_week', 'without_assignee', 'avg_completion_days'],
  },
  matches: {
    available: ['total', 'new_in_period', 'active', 'expiring_soon', 'terminated_in_period', 'renewals_in_period', 'without_end_date', 'avg_duration_days', 'reach_rate'],
    default: ['total', 'new_in_period', 'active', 'expiring_soon', 'terminated_in_period', 'renewals_in_period', 'without_end_date', 'avg_duration_days', 'reach_rate'],
  },
  outreach: {
    available: ['total_targets', 'open_todo', 'called_in_period', 'reached', 'not_reached', 'conversion_pct', 'campaigns_active', 'campaigns_done_in_period', 'due_today'],
    default: ['total_targets', 'open_todo', 'called_in_period', 'reached', 'not_reached', 'conversion_pct', 'campaigns_active', 'campaigns_done_in_period', 'due_today'],
  },
  whatsapp: {
    available: ['conversations_total', 'active_7d', 'new_in_period', 'inbound_in_period', 'outbound_in_period', 'app_echoes_in_period', 'escalations_open', 'unanswered_over_window', 'avg_first_response_minutes'],
    default: ['conversations_total', 'active_7d', 'new_in_period', 'inbound_in_period', 'outbound_in_period', 'app_echoes_in_period', 'escalations_open', 'unanswered_over_window', 'avg_first_response_minutes'],
  },
}
// Every BE key now has a card (REPORT-KPI-CARDS-MISSING-1); a future BE-only key goes here to stay visible.
const NOT_YET_RENDERED: Record<string, string[]> = {}

describe('kpiCatalog — equals the backend catalogue (REPORT-KPI-CATALOG-DRIFT-1)', () => {
  it.each(Object.keys(BACKEND_KPIS))('%s uses the backend keys and the backend default list', (scope) => {
    const be = BACKEND_KPIS[scope]
    const keys = getReportKpiCatalog(scope as 'candidates').map(c => c.key)
    expect([...keys, ...(NOT_YET_RENDERED[scope] ?? [])].sort()).toEqual([...be.available].sort())
    expect(getReportKpiDefaultOrder(scope as 'candidates')).toEqual(be.default)
  })
})
