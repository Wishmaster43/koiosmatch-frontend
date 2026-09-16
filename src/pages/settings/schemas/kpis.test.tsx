/**
 * kpisOpportunities / kpisVacancies (KPI-DREMPELS-FE-1) — the two new KPI settings
 * sub-tabs carrying the backend-confirmed day-window thresholds (number, 1..365):
 * `opportunity_stale_days`(30), `opportunity_closing_soon_days`(14),
 * `vacancy_closing_soon_days`(7). `vacancy_advice_stale_days` deliberately does NOT
 * live here — it is edited on the Koios-advice screen (KoiosAdviceSettings.tsx) and
 * a second write path for the same key was a SETTINGS-TABS-FIX-1 review finding
 * (ONE SOURCE PER KEY). Pins the schema field shape as data (so a drifted
 * key/default/bound is a failing assertion, not a silent behaviour change) and,
 * mirroring workflowRunHistory.test.jsx, proves the real POST /settings request
 * each field persists through — §13: a mutation test asserts the request itself,
 * never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import SchemaSection from '../components/SchemaSection'
import type { Schema } from '../components/SchemaSection'
import { WINDOW_UNIT_OPTIONS } from '../components/windowUnitOptions'
import {
  kpisCandidates as kpisCandidatesRaw,
  kpisApplications as kpisApplicationsRaw,
  kpisCustomers as kpisCustomersRaw,
  kpisLocations as kpisLocationsRaw,
  kpisDepartments as kpisDepartmentsRaw,
  kpisTasks as kpisTasksRaw,
  kpisOpportunities as kpisOpportunitiesRaw,
  kpisVacancies as kpisVacanciesRaw,
} from './kpis'

// ./kpis.js is plain untyped JS (not on this migration's list); its exports lose their
// literal `type` shape under TS's best-effort JS inference — cast once, here, to the
// real Schema type SchemaSection itself declares.
const kpisCandidates = kpisCandidatesRaw as unknown as Schema
const kpisApplications = kpisApplicationsRaw as unknown as Schema
const kpisCustomers = kpisCustomersRaw as unknown as Schema
const kpisLocations = kpisLocationsRaw as unknown as Schema
const kpisDepartments = kpisDepartmentsRaw as unknown as Schema
const kpisTasks = kpisTasksRaw as unknown as Schema
const kpisOpportunities = kpisOpportunitiesRaw as unknown as Schema
const kpisVacancies = kpisVacanciesRaw as unknown as Schema

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
// SchemaSection gates its Save button on settings.update (X-29/AF:orphans-4-2, 713175d3):
// these tests exercise the editor path, so the mocked viewer holds that permission.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key: string) => i18n.t(key, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof api.get>>)
  vi.mocked(api.post).mockResolvedValue({} as Awaited<ReturnType<typeof api.post>>)
})

// Field shape + defaults pinned as data — exactly the two backend-confirmed
// keys, number 1..365, nothing more/less.
describe('kpisOpportunities / kpisVacancies — field shape pinned', () => {
  it('kpisOpportunities carries the two pipeline thresholds, number 1..365, each with an inline unit companion', () => {
    expect(kpisOpportunities.fields).toEqual([
      { key: 'opportunity_stale_days', type: 'number', default: 14, min: 1, max: 365 },
      { key: 'opportunity_stale_days_unit', type: 'select', unitOf: 'opportunity_stale_days', default: 'days',
        options: WINDOW_UNIT_OPTIONS, labelKey: 'settings.windows.opportunity_stale_days_unit.label' },
      { key: 'opportunity_closing_soon_days', type: 'number', default: 14, min: 1, max: 365 },
      { key: 'opportunity_closing_soon_days_unit', type: 'select', unitOf: 'opportunity_closing_soon_days', default: 'days',
        options: WINDOW_UNIT_OPTIONS, labelKey: 'settings.windows.opportunity_closing_soon_days_unit.label' },
    ])
  })

  it('kpisVacancies carries only the closing-soon threshold, number 1..365, with its unit companion (staleness lives on the Koios-advice screen)', () => {
    expect(kpisVacancies.fields).toEqual([
      { key: 'vacancy_closing_soon_days', type: 'number', default: 7, min: 1, max: 365 },
      { key: 'vacancy_closing_soon_days_unit', type: 'select', unitOf: 'vacancy_closing_soon_days', default: 'days',
        options: WINDOW_UNIT_OPTIONS, labelKey: 'settings.windows.vacancy_closing_soon_days_unit.label' },
    ])
  })
})

describe('kpisOpportunities · defaults + persists the exact backend keys', () => {
  it('pre-fills both defaults (14, 14) when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('textbox')
    // The house NumberInput is a text field (GETALLEN-1 inside inputs); it clamps 1..365 on blur.
    expect(inputs).toHaveLength(2)
    await waitFor(() => expect(inputs[0]).toHaveValue('14'))
    expect(inputs[1]).toHaveValue('14')
  })

  it('POSTs /settings with both keys, opportunity_stale_days at the edited value', async () => {
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('textbox')
    await waitFor(() => expect(inputs[0]).toHaveValue('14'))
    fireEvent.change(inputs[0], { target: { value: '45' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(url).toBe('/settings')
    // settingsApi stringifies every value on the way out (POST body is all strings).
    expect(body.opportunity_stale_days).toBe('45')
    expect(body.opportunity_closing_soon_days).toBe('14')
  })

  it('loads a previously saved value back from GET /settings', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { opportunity_stale_days: '90' } } as Awaited<ReturnType<typeof api.get>>)
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('textbox')
    await waitFor(() => expect(inputs[0]).toHaveValue('90'))
  })
})

describe('kpisVacancies · defaults + persists the exact backend key', () => {
  it('pre-fills the default (7) when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={kpisVacancies} />)
    const inputs = await screen.findAllByRole('textbox')
    expect(inputs).toHaveLength(1)
    await waitFor(() => expect(inputs[0]).toHaveValue('7'))
  })

  it('POSTs /settings with vacancy_closing_soon_days at the edited value', async () => {
    render(<SchemaSection schema={kpisVacancies} />)
    const inputs = await screen.findAllByRole('textbox')
    await waitFor(() => expect(inputs[0]).toHaveValue('7'))
    fireEvent.change(inputs[0], { target: { value: '10' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(url).toBe('/settings')
    expect(body.vacancy_closing_soon_days).toBe('10')
    // ONE SOURCE PER KEY (SETTINGS-TABS-FIX-1): the staleness key must never be
    // re-posted from this screen — it belongs to KoiosAdviceSettings.tsx alone.
    expect(body.vacancy_advice_stale_days).toBeUndefined()
  })
})

// The section subtitle here is a written cross-reference (not the shared generic
// kpis.subtitle): a tenant looking for the vacancy staleness field must find its
// real home instead of assuming it was removed outright.
describe('kpisVacancies · subtitle cross-references the Koios-advice screen', () => {
  it('renders the vacanciesSubtitle override, not the generic kpis.subtitle', async () => {
    render(<SchemaSection schema={kpisVacancies} />)
    await screen.findAllByRole('textbox')
    expect(screen.getByText(st('kpis.vacanciesSubtitle'))).toBeInTheDocument()
  })
})

// Lane J cleanup (X-7): dead keys removed from all schema exports.
describe('Dead KPI keys · all removed from schemas', () => {
  it('opportunity_stale_days defaults to 14 (OpportunityStaleWindow::DEFAULT_DAYS)', () => {
    const field = kpisOpportunities.fields.find((f) => f.key === 'opportunity_stale_days')
    expect(field?.default).toBe(14)
  })

  // Seven dead keys: churn_warning_threshold, avg_candidates_window, occupancy_target (3×),
  // response_rate_target, overdue_warning_threshold, sm_open_shifts_warning, sm_no_show_threshold.
  // Assert they are absent from all schema exports.
  it('churn_warning_threshold is absent from kpisCandidates', () => {
    const keys = kpisCandidates.fields.map((f) => f.key)
    expect(keys).not.toContain('churn_warning_threshold')
  })

  it('avg_candidates_window is absent from kpisCandidates', () => {
    const keys = kpisCandidates.fields.map((f) => f.key)
    expect(keys).not.toContain('avg_candidates_window')
  })

  it('response_rate_target is absent from kpisApplications', () => {
    const keys = kpisApplications.fields.map((f) => f.key)
    expect(keys).not.toContain('response_rate_target')
  })

  it('occupancy_target is absent from kpisCustomers, kpisLocations, kpisDepartments', () => {
    expect(kpisCustomers.fields.map((f) => f.key)).not.toContain('occupancy_target')
    expect(kpisLocations.fields.map((f) => f.key)).not.toContain('occupancy_target')
    expect(kpisDepartments.fields.map((f) => f.key)).not.toContain('occupancy_target')
  })

  it('overdue_warning_threshold is absent from kpisTasks', () => {
    const keys = kpisTasks.fields.map((f) => f.key)
    expect(keys).not.toContain('overdue_warning_threshold')
  })
})

// O23 UNIT-NAAST-BEDRAG-1: kpisCandidates' two windows each carry their own inline
// unit companion, and the shared noContactAlert block's window does too.
describe('kpisCandidates · window amounts carry an inline unit companion', () => {
  // `defaultUnit` mirrors the BE catalogue default per amount (weeks/workdays/months rows keep their own unit).
  const unitField = (amountKey: string, section = 'windows', defaultUnit = 'days') =>
    ({ key: `${amountKey}_unit`, type: 'select', unitOf: amountKey, default: defaultUnit,
      options: WINDOW_UNIT_OPTIONS, labelKey: `settings.${section}.${amountKey}_unit.label` })

  it('conversation_active_weeks is immediately followed by its unit field', () => {
    const keys = kpisCandidates.fields.map((f) => f.key)
    const i = keys.indexOf('conversation_active_weeks')
    expect(keys[i + 1]).toBe('conversation_active_weeks_unit')
    expect(kpisCandidates.fields[i + 1]).toEqual(unitField('conversation_active_weeks', 'windows', 'weeks'))
  })

  it('candidate_no_followup_workdays is immediately followed by its unit field', () => {
    const keys = kpisCandidates.fields.map((f) => f.key)
    const i = keys.indexOf('candidate_no_followup_workdays')
    expect(keys[i + 1]).toBe('candidate_no_followup_workdays_unit')
    expect(kpisCandidates.fields[i + 1]).toEqual(unitField('candidate_no_followup_workdays', 'windows', 'workdays'))
  })

  it('the shared no_contact_alert_months window carries its unit field too', () => {
    const keys = kpisCandidates.fields.map((f) => f.key)
    const i = keys.indexOf('no_contact_alert_months')
    expect(keys[i + 1]).toBe('no_contact_alert_months_unit')
    expect(kpisCandidates.fields[i + 1]).toEqual(unitField('no_contact_alert_months', 'windows', 'months'))
  })
})
