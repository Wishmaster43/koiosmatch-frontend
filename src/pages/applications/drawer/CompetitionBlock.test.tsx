/**
 * CompetitionBlock — covers the no-vacancy/loading/error states, the funnel chip
 * row derived from applicationsByPhase, "alone in phase" vs "with N others", the
 * privacy guarantee (§8: never render another candidate's name/data in the
 * SUMMARY line) and, since Danny 21-08 ruling 3 ("ik zie geen lijst??"), the
 * expandable list of the vacancy's OTHER applicants — collapsed by default,
 * sourced from the already-fetched vacancy.applications (no second request),
 * and navigating via the SAME openEntity('applications', id) every other
 * cross-record click in the app uses.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompetitionBlock from './CompetitionBlock'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'

// Key-echo i18n (repo-wide precedent) — deterministic, ignores interpolation so
// assertions target the literal key/count rather than translated prose.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}))

// Fixed tenant funnel order/colours — mirrors DEFAULT_FUNNEL_TYPES in LookupsContext.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    funnelTypes: [
      // eslint-disable-next-line no-restricted-syntax -- DATA fixture (tenant lookup colours), not a UI colour choice
      { value: 'applied', label: 'Applied', color: '#94A3B8' },
      // eslint-disable-next-line no-restricted-syntax -- DATA fixture (tenant lookup colours), not a UI colour choice
      { value: 'invited', label: 'Invited', color: '#8C86D9' },
      // eslint-disable-next-line no-restricted-syntax -- DATA fixture (tenant lookup colours), not a UI colour choice
      { value: 'hired', label: 'Hired', color: '#79B58E' },
    ],
  }),
}))

// SOLLICITANTEN-2: row click navigates the same way every other cross-record
// click does — mirrors CustomerApplicationsList.test.tsx's own mock shape.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// Mock the shared hook directly — this file tests CompetitionBlock's own
// rendering, not useApplicationVacancy's fetch (that has its own use elsewhere).
const mockUseApplicationVacancy = vi.fn()
vi.mock('../hooks/useApplicationVacancy', () => ({
  useApplicationVacancy: (id: unknown) => mockUseApplicationVacancy(id),
}))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, vacancyId: 'v1', phaseKey: 'applied', phaseLabel: 'Applied', ...over,
} as unknown as ApplicationDetail)

const vac = (over: Partial<VacancyDetail> = {}) => ({
  applicationsCount: 3, applicationsByPhase: { applied: 2, hired: 1 }, applications: [], ...over,
} as unknown as VacancyDetail)

describe('CompetitionBlock', () => {
  it('renders only the no-vacancy line when nothing is linked', () => {
    // The hook is still called (rules of hooks) even when the component short-
    // circuits on the missing vacancyId — a default return keeps that safe.
    mockUseApplicationVacancy.mockReturnValue({ vacancy: null, loading: false, error: false })
    render(<CompetitionBlock application={app({ vacancyId: null })} />)
    expect(screen.getByText('competition.noVacancy')).toBeInTheDocument()
    expect(screen.queryByText('competition.title')).toBeNull()
  })

  it('shows the loading state while the vacancy fetch is in flight', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: null, loading: true, error: false })
    render(<CompetitionBlock application={app()} />)
    expect(screen.getByText('competition.loading')).toBeInTheDocument()
  })

  it('shows the error state when the vacancy fetch fails', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: null, loading: false, error: true })
    render(<CompetitionBlock application={app()} />)
    expect(screen.getByText('competition.error')).toBeInTheDocument()
  })

  it('renders one soft chip per funnel phase present, in tenant order, with counts', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac(), loading: false, error: false })
    render(<CompetitionBlock application={app()} />)
    expect(screen.getByText('Applied 2')).toBeInTheDocument()
    expect(screen.getByText('Hired 1')).toBeInTheDocument()
    // 'invited' has a count of 0 in this fixture — no chip rendered for it.
    expect(screen.queryByText(/Invited/)).toBeNull()
  })

  it('shows "with N others" when this candidate shares its phase', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applicationsByPhase: { applied: 3 }, applicationsCount: 3 }), loading: false, error: false })
    render(<CompetitionBlock application={app({ phaseKey: 'applied' })} />)
    expect(screen.getByText(/competition\.inPhase/)).toBeInTheDocument()
    expect(screen.queryByText(/competition\.aloneInPhase/)).toBeNull()
  })

  it('shows "alone in phase" when no one else shares this phase', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applicationsByPhase: { applied: 1, hired: 2 }, applicationsCount: 3 }), loading: false, error: false })
    render(<CompetitionBlock application={app({ phaseKey: 'applied' })} />)
    expect(screen.getByText(/competition\.aloneInPhase/)).toBeInTheDocument()
  })

  it('shows the "only one" line and no chip row when the vacancy has a single applicant', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applicationsByPhase: { applied: 1 }, applicationsCount: 1 }), loading: false, error: false })
    render(<CompetitionBlock application={app({ phaseKey: 'applied' })} />)
    expect(screen.getByText('competition.onlyOne')).toBeInTheDocument()
    expect(screen.queryByText(/Applied/)).toBeNull()
  })

  // PRIVACY (§8): counts only — never another candidate's name in this block.
  it('never renders another candidate name — counts only', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac(), loading: false, error: false })
    render(<CompetitionBlock application={app()} />)
    expect(screen.queryByText(/Jansen|Bakker|@/)).toBeNull()
  })

  // S7: "2 sollicitanten op deze vacature" is now a real EntityLink to the
  // vacancy record, not plain text.
  it('renders the applicant count as a clickable link to the vacancy', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac(), loading: false, error: false })
    render(<CompetitionBlock application={app({ vacancyId: 'v1' })} />)
    const link = screen.getByText(/competition\.total/)
    expect(link.closest('button')).not.toBeNull()
  })
})

// SOLLICITANTEN-2 (Danny 21-08 ruling 3): the expandable list of the vacancy's
// OTHER applicants. Measured data source: vacancy.applications — the SAME
// GET /vacancies/{id} response the vacancy drawer's own ApplicantsTab reads —
// so no second request is fired to expand; the toggle only reveals rows
// already in memory (see the component's own doc comment).
describe('CompetitionBlock · expandable other-applicants list (Danny 21-08 ruling 3)', () => {
  // The application row shape (VacancyDetail.applications[number]) — cast once
  // here so every fixture below stays a plain object literal.
  const row = (over: Partial<VacancyDetail['applications'][number]>): VacancyDetail['applications'][number] => ({
    id: over.id, candidateId: null, candidateName: '', candidateInitials: '',
    phaseValue: null, phaseLabel: '', phaseColor: '', source: '', created: '', ...over,
  })
  const others = [
    // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
    row({ id: 'a2', candidateId: 'c2', candidateName: 'Anna de Vries', candidateInitials: 'AV', phaseValue: 'invited', phaseLabel: 'Invited', phaseColor: '#8C86D9', source: 'Website' }),
    // eslint-disable-next-line no-restricted-syntax -- DATA fixture (a tenant lookup colour), not a UI colour choice
    row({ id: 'a3', candidateId: 'c3', candidateName: 'Bram Bakker', candidateInitials: 'BB', phaseValue: 'applied', phaseLabel: 'Applied', phaseColor: '#94A3B8', source: 'Indeed' }),
  ]

  it('is collapsed by default — no other-applicant row visible', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applications: [...others, row({ id: 1 })] }), loading: false, error: false })
    render(<CompetitionBlock application={app()} />)
    expect(screen.queryByText('Anna de Vries')).toBeNull()
    expect(screen.getByRole('button', { name: /competition\.showList/ })).toBeInTheDocument()
  })

  it('expands to show one compact row per OTHER applicant, excluding this application itself', async () => {
    const user = userEvent.setup()
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applications: [...others, row({ id: 1, candidateName: 'This applicant' })] }), loading: false, error: false })
    render(<CompetitionBlock application={app({ id: 1 })} />)
    await user.click(screen.getByRole('button', { name: /competition\.showList/ }))
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Bram Bakker')).toBeInTheDocument()
    // The current application's own row is filtered out, never listed as "other".
    expect(screen.queryByText('This applicant')).toBeNull()
    // Each row shows the phase as a StatusPill (soft chip), not a raw string.
    expect(screen.getAllByText('Invited').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /competition\.hideList/ }))
    expect(screen.queryByText('Anna de Vries')).toBeNull()
  })

  it('navigates to the clicked applicant via the same cross-record navigation the app uses elsewhere', async () => {
    const user = userEvent.setup()
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applications: others }), loading: false, error: false })
    render(<CompetitionBlock application={app()} />)
    await user.click(screen.getByRole('button', { name: /competition\.showList/ }))
    await user.click(screen.getByText('Anna de Vries'))
    expect(openEntity).toHaveBeenCalledWith('applications', 'a2')
  })

  it('renders no expand toggle at all when there are no other applicants', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac({ applications: [row({ id: 1 })] }), loading: false, error: false })
    render(<CompetitionBlock application={app({ id: 1 })} />)
    expect(screen.queryByRole('button', { name: /competition\.showList/ })).toBeNull()
  })
})
