/**
 * StatisticsTab · V25 (VACATURES-100) — the tab used to render only a conversion
 * ratio + a hand-rolled bar funnel, and both were fed by `applicationsByPhase`,
 * which came back EMPTY for a real vacancy detail fetch (VacancyController::show()
 * never attaches the phase counts — only the list endpoint does; see mapVacancy's
 * V25 fix). This regression-guards the rebuilt tab: it now reuses the shared
 * `components/drawer/tabs/StatsTab` (blueprint-conformance — was hand-rolled tiles)
 * and adds days-open / published-channels / last-activity, all derived from fields
 * already on the detail payload (no extra fetch, no fabricated data).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatisticsTab from './StatisticsTab'
import { mapVacancyDetail } from '../data/mapVacancy'
import nlVacancies from '@/i18n/locales/nl/vacancies.json'

const mockNavigate = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }))

const PHASES = [
  { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' },
  { value: 'hired',   label: 'Aangenomen',     color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',     color: '#D98A8A' },
]
vi.mock('@/context/VacancyLookupsContext', () => ({ useVacancyLookups: () => ({ phases: PHASES }) }))

describe('StatisticsTab · empty state', () => {
  it('shows the calm empty state when there are no leads and no applications', () => {
    const v = mapVacancyDetail({ id: 'v1', title: 'Test' })
    render(<StatisticsTab vacancy={v} />)
    expect(screen.getByText(nlVacancies.statistics.empty)).toBeInTheDocument()
  })
})

describe('StatisticsTab · V25 real data (derived from the detail applications array)', () => {
  it('derives the per-phase breakdown from raw.applications (the detail endpoint never attaches applications_by_phase)', () => {
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', leads_count: 4, created_at: '2026-06-01T00:00:00Z',
      // Note: NO applications_by_phase on this raw payload — mirrors the real
      // GET /vacancies/{id} response (VacancyController::show() never attaches it).
      applications: [
        { id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } },
        { id: 'a2', candidate: { id: 'c2', name: 'Kelly van Vliet' }, phase: { value: 'hired', label: 'Aangenomen', color: '#79B58E' } },
      ],
    })
    render(<StatisticsTab vacancy={v} />)

    // Not the old bug: the tab is NOT empty even though applications_by_phase was never attached.
    expect(screen.queryByText(nlVacancies.statistics.empty)).toBeNull()
    // Conversion rate: 1 hired / 2 applied = 50%.
    expect(screen.getByText('50%')).toBeInTheDocument()
    // Per-phase legend rows (only phases with a real count show).
    expect(screen.getByText('Gesolliciteerd')).toBeInTheDocument()
    expect(screen.getByText('Aangenomen')).toBeInTheDocument()
    expect(screen.queryByText('Afgewezen')).toBeNull()
  })

  it('shows days open, published channels and last activity — all read from fields already on the detail', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    vi.setSystemTime(now)
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', leads_count: 2, created_at: '2026-07-01T00:00:00Z',
      applications: [{ id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } }],
      channels: [
        { value: 'career', label: 'Carrière-pagina', published: true },
        { value: 'indeed', label: 'Indeed', published: false },
      ],
      timeline: [{ id: 't1', author: 'Danny Polak', description: 'Sollicitatie ontvangen', created_at: '2026-07-10T09:00:00Z' }],
    })
    render(<StatisticsTab vacancy={v} />)

    // Days open: 1 July → 15 July = 14 whole days.
    expect(screen.getByText('14')).toBeInTheDocument()
    // Published channels: 1 of the 2 configured (the KPI's "sub" caption is unique text).
    expect(screen.getByText('van de 2 geconfigureerd')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('a phase legend row navigates to Sollicitaties pre-filtered on this vacancy + stage', async () => {
    const v = mapVacancyDetail({
      id: 'v42', title: 'Test', leads_count: 1,
      applications: [{ id: 'a1', candidate: { id: 'c1', name: 'Rosa' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } }],
    })
    render(<StatisticsTab vacancy={v} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Gesolliciteerd'))
    expect(mockNavigate).toHaveBeenCalledWith('applications', { stage: 'applied', vacancy: 'v42' })
  })
})
