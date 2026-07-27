/**
 * CompetitionBlock — covers the no-vacancy/loading/error states, the funnel chip
 * row derived from applicationsByPhase, "alone in phase" vs "with N others", and
 * the privacy guarantee (§8): never render another candidate's name/data.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  applicationsCount: 3, applicationsByPhase: { applied: 2, hired: 1 }, ...over,
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
})
