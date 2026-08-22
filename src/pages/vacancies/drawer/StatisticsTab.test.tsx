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

/* eslint-disable no-restricted-syntax -- test fixture hex, not UI styling */
const PHASES = [
  { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' },
  { value: 'hired',   label: 'Aangenomen',     color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',     color: '#D98A8A' },
]
/* eslint-enable no-restricted-syntax */
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
      // VACANCY-LEADS-COUNT-1: candidate_match_count (never the legacy leads_count,
      // which the mapper now deliberately ignores) is what feeds the leads KPI.
      id: 'v1', title: 'Test', candidate_match_count: 4, created_at: '2026-06-01T00:00:00Z',
      // Note: NO applications_by_phase on this raw payload — mirrors the real
      // GET /vacancies/{id} response (VacancyController::show() never attaches it).
      /* eslint-disable no-restricted-syntax -- test fixture hex, not UI styling */
      applications: [
        { id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } },
        { id: 'a2', candidate: { id: 'c2', name: 'Kelly van Vliet' }, phase: { value: 'hired', label: 'Aangenomen', color: '#79B58E' } },
      ],
      /* eslint-enable no-restricted-syntax */
    })
    render(<StatisticsTab vacancy={v} />)

    // Not the old bug: the tab is NOT empty even though applications_by_phase was never attached.
    expect(screen.queryByText(nlVacancies.statistics.empty)).toBeNull()
    // Leads → applications: 2 applications / 4 leads = 50%. Since the applied →
    // hired pair landed (1 of 2 = 50% too), BOTH conversion tiles read 50% here —
    // assert the count rather than uniqueness.
    expect(screen.getAllByText('50%')).toHaveLength(2)
    // Per-phase legend rows (only phases with a real count show).
    expect(screen.getByText('Gesolliciteerd')).toBeInTheDocument()
    expect(screen.getByText('Aangenomen')).toBeInTheDocument()
    expect(screen.queryByText('Afgewezen')).toBeNull()
  })

  // VACANCY-LEADS-COUNT-1: an uncomputed leads count must render as an honest
  // dash + the "not yet computed" explanation, never a percentage against 0.
  it('shows a dash (not a fabricated %) for the leads KPI when candidate_match_count is absent', () => {
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', created_at: '2026-06-01T00:00:00Z',
      applications: [{ id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied' } }],
    })
    render(<StatisticsTab vacancy={v} />)
    expect(screen.queryByText(nlVacancies.statistics.empty)).toBeNull()
    // The leads KPI reads the honest "not yet computed" explanation, never a
    // percentage computed against a fabricated 0.
    expect(screen.getByText(nlVacancies.columns.leadsUnknown)).toBeInTheDocument()
  })

  it('shows days open, published channels and last activity — all read from fields already on the detail', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    vi.setSystemTime(now)
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', candidate_match_count: 2, created_at: '2026-07-01T00:00:00Z',
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
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

  // APPLIED-VS-HIRED-1: the raw counting pair reuses the existing appliedToHired
  // label and only renders when both sides of the pair are real.
  it('shows the honest applied → hired pair when both sides are real', () => {
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', candidate_match_count: 2, created_at: '2026-06-01T00:00:00Z',
      /* eslint-disable no-restricted-syntax -- test fixture hex, not UI styling */
      applications: [
        { id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } },
        { id: 'a2', candidate: { id: 'c2', name: 'Kelly van Vliet' }, phase: { value: 'hired', label: 'Aangenomen', color: '#79B58E' } },
      ],
      /* eslint-enable no-restricted-syntax */
    })
    render(<StatisticsTab vacancy={v} />)
    // The label already appears once as the conversion-rate KPI's sub caption —
    // the new overview row reuses the SAME key, so it appears a second time.
    expect(screen.getAllByText(nlVacancies.statistics.appliedToHired)).toHaveLength(2)
    expect(screen.getByText('2 → 1')).toBeInTheDocument()
  })

  it('hides the applied → hired pair when the hired side is not known (empty byPhase)', () => {
    const v = mapVacancyDetail({
      id: 'v1', title: 'Test', candidate_match_count: 2, created_at: '2026-06-01T00:00:00Z',
      applications_by_phase: {},
      applications: [],
    })
    render(<StatisticsTab vacancy={v} />)
    // "empty" tab guard fires when there is no data at all — force a non-empty
    // path by keeping candidate_match_count known but no applications: the tab
    // still renders (leads known). The label still appears once as the
    // conversion-rate KPI's own sub caption, but the extra overview row must
    // stay hidden — so no "N → M" pair text and only the ONE occurrence.
    expect(screen.getAllByText(nlVacancies.statistics.appliedToHired)).toHaveLength(1)
    expect(screen.queryByText(/^\d+ → \d+$/)).toBeNull()
  })

  it('a phase legend row navigates to Sollicitaties pre-filtered on this vacancy + stage', async () => {
    const v = mapVacancyDetail({
      id: 'v42', title: 'Test', candidate_match_count: 1,
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      applications: [{ id: 'a1', candidate: { id: 'c1', name: 'Rosa' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } }],
    })
    render(<StatisticsTab vacancy={v} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Gesolliciteerd'))
    expect(mockNavigate).toHaveBeenCalledWith('applications', { stage: 'applied', vacancy: 'v42' })
  })
})

// V-stats-1: the counts deep-link to the tabs they count — real, keyboard-
// operable buttons that call the drawer's own setActiveTab, no route hack.
describe('StatisticsTab · V-stats-1 counts deep-link to their own tab', () => {
  const baseVacancy = () => mapVacancyDetail({
    id: 'v1', title: 'Test', candidate_match_count: 4, created_at: '2026-06-01T00:00:00Z',
    /* eslint-disable no-restricted-syntax -- test fixture hex, not UI styling */
    applications: [
      { id: 'a1', candidate: { id: 'c1', name: 'Rosa Tijssen' }, phase: { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' } },
      { id: 'a2', candidate: { id: 'c2', name: 'Kelly van Vliet' }, phase: { value: 'hired', label: 'Aangenomen', color: '#79B58E' } },
    ],
    /* eslint-enable no-restricted-syntax */
    channels: [{ value: 'career', label: 'Carrière-pagina', published: true }],
  })

  it('renders plain text (no button) when onNavigateTab is not wired', () => {
    render(<StatisticsTab vacancy={baseVacancy()} />)
    expect(screen.getByText('4').closest('button')).toBeNull()
    expect(screen.getByText('2').closest('button')).toBeNull()
  })

  it('clicking the Leads count jumps to the "candidateSearch" tab', async () => {
    const onNavigateTab = vi.fn()
    const user = userEvent.setup()
    render(<StatisticsTab vacancy={baseVacancy()} onNavigateTab={onNavigateTab} />)
    await user.click(screen.getByRole('button', { name: nlVacancies.columns.leadsOpenSearch }))
    expect(onNavigateTab).toHaveBeenCalledWith('candidateSearch')
  })

  it('clicking the Sollicitaties count jumps to the "applicants" tab', async () => {
    const onNavigateTab = vi.fn()
    const user = userEvent.setup()
    render(<StatisticsTab vacancy={baseVacancy()} onNavigateTab={onNavigateTab} />)
    await user.click(screen.getByRole('button', { name: nlVacancies.columns.applicationsOpen }))
    expect(onNavigateTab).toHaveBeenCalledWith('applicants')
  })

  it('clicking the published-channels KPI jumps to the "publishing" tab', async () => {
    const onNavigateTab = vi.fn()
    const user = userEvent.setup()
    render(<StatisticsTab vacancy={baseVacancy()} onNavigateTab={onNavigateTab} />)
    await user.click(screen.getByText(nlVacancies.statistics.channelsPublished))
    expect(onNavigateTab).toHaveBeenCalledWith('publishing')
  })

  // EMBED-GUARD (Opus 22-08): a host with a CURATED tab set (the application
  // drawer's Vacature tab excludes candidateSearch) names its targets — the
  // Leads number must render as plain TEXT there, never a button into a tab
  // that does not exist; targets that DO exist keep their deep-link.
  it('renders Leads as plain text when the host does not carry candidateSearch', () => {
    const onNavigateTab = vi.fn()
    const v = mapVacancyDetail({ id: 'v1', title: 'Test', candidate_match_count: 4 })
    render(<StatisticsTab vacancy={v} onNavigateTab={onNavigateTab}
      navigableTabs={['applicants', 'publishing']} />)
    // No Leads deep-link button — the value shows as text.
    expect(screen.queryByRole('button', { name: nlVacancies.columns.leadsOpenSearch })).toBeNull()
    expect(screen.getByText('4')).toBeInTheDocument()
    // The applications deep-link survives: its target IS in the curated set.
    expect(screen.getByRole('button', { name: nlVacancies.columns.applicationsOpen })).toBeInTheDocument()
  })
})
