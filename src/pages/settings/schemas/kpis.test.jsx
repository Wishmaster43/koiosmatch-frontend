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
import { kpisOpportunities, kpisVacancies } from './kpis'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key) => i18n.t(key, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({})
})

// Field shape + defaults pinned as data — exactly the four backend-confirmed
// keys, number 1..365, nothing more/less.
describe('kpisOpportunities / kpisVacancies — field shape pinned', () => {
  it('kpisOpportunities carries the two pipeline thresholds, number 1..365', () => {
    expect(kpisOpportunities.fields).toEqual([
      { key: 'opportunity_stale_days', type: 'number', default: 30, min: 1, max: 365 },
      { key: 'opportunity_closing_soon_days', type: 'number', default: 14, min: 1, max: 365 },
    ])
  })

  it('kpisVacancies carries only the closing-soon threshold, number 1..365 (staleness lives on the Koios-advice screen)', () => {
    expect(kpisVacancies.fields).toEqual([
      { key: 'vacancy_closing_soon_days', type: 'number', default: 7, min: 1, max: 365 },
    ])
  })
})

describe('kpisOpportunities · defaults + persists the exact backend keys', () => {
  it('pre-fills both defaults (30, 14) when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('spinbutton')
    expect(inputs).toHaveLength(2)
    await waitFor(() => expect(inputs[0]).toHaveValue(30))
    expect(inputs[1]).toHaveValue(14)
    expect(inputs[0]).toHaveAttribute('min', '1')
    expect(inputs[0]).toHaveAttribute('max', '365')
  })

  it('POSTs /settings with both keys, opportunity_stale_days at the edited value', async () => {
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('spinbutton')
    await waitFor(() => expect(inputs[0]).toHaveValue(30))
    fireEvent.change(inputs[0], { target: { value: '45' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/settings')
    // settingsApi stringifies every value on the way out (POST body is all strings).
    expect(body.opportunity_stale_days).toBe('45')
    expect(body.opportunity_closing_soon_days).toBe('14')
  })

  it('loads a previously saved value back from GET /settings', async () => {
    api.get.mockResolvedValue({ data: { opportunity_stale_days: '90' } })
    render(<SchemaSection schema={kpisOpportunities} />)
    const inputs = await screen.findAllByRole('spinbutton')
    await waitFor(() => expect(inputs[0]).toHaveValue(90))
  })
})

describe('kpisVacancies · defaults + persists the exact backend key', () => {
  it('pre-fills the default (7) when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={kpisVacancies} />)
    const inputs = await screen.findAllByRole('spinbutton')
    expect(inputs).toHaveLength(1)
    await waitFor(() => expect(inputs[0]).toHaveValue(7))
  })

  it('POSTs /settings with vacancy_closing_soon_days at the edited value', async () => {
    render(<SchemaSection schema={kpisVacancies} />)
    const inputs = await screen.findAllByRole('spinbutton')
    await waitFor(() => expect(inputs[0]).toHaveValue(7))
    fireEvent.change(inputs[0], { target: { value: '10' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
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
    await screen.findAllByRole('spinbutton')
    expect(screen.getByText(st('kpis.vacanciesSubtitle'))).toBeInTheDocument()
  })
})
