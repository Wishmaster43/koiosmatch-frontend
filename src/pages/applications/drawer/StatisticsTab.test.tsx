/**
 * StatisticsTab — Danny 22-08 regression guard: Andere sollicitanten
 * (CompetitionBlock) moved off the Sollicitatie tab onto this new tab; this
 * locks in that the moved block still renders here, byte-for-byte the same
 * component CompetitionBlock.test.tsx already covers in isolation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatisticsTab from './StatisticsTab'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'

// Key-echo i18n (repo-wide precedent) — deterministic, ignores interpolation.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}))

vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [] }),
}))

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))

const mockUseApplicationVacancy = vi.fn()
vi.mock('../hooks/useApplicationVacancy', () => ({
  useApplicationVacancy: (id: unknown) => mockUseApplicationVacancy(id),
}))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, vacancyId: 'v1', phaseKey: 'applied', phaseLabel: 'Applied', ...over,
} as unknown as ApplicationDetail)

const vac = (over: Partial<VacancyDetail> = {}) => ({
  applicationsCount: 1, applicationsByPhase: { applied: 1 }, applications: [], ...over,
} as unknown as VacancyDetail)

describe('StatisticsTab (Danny 22-08 — Andere sollicitanten moved here)', () => {
  it('renders the moved CompetitionBlock (Andere sollicitanten)', () => {
    mockUseApplicationVacancy.mockReturnValue({ vacancy: vac(), loading: false, error: false })
    render(<StatisticsTab application={app()} />)
    expect(screen.getByText('competition.title')).toBeInTheDocument()
  })
})
