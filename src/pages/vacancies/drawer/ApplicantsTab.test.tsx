import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicantsTab from './ApplicantsTab'
import { mapVacancyDetail } from '../data/mapVacancy'

// The real tenant phase lookup — a stable `value` per phase, unlike WorkTab's
// candidate-embed which only carries a resolved label (V14: this side wires the
// filter directly to the lookup instead of a derived-from-rows fallback).
const PHASES = [
  { value: 'applied', label: 'Applied', color: '#3B82F6' },
  { value: 'hired', label: 'Hired', color: '#10B981' },
]
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ phases: PHASES, phaseMeta: () => ({ label: null, color: null }) }),
}))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: {} } })) }, unwrap: (r: unknown) => r }))
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({ default: () => null }))
vi.mock('@/pages/applications/AddApplicationModal', () => ({ default: () => null }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API-shaped fixture, mapVacancyDetail's own input type
const vacancy = (applications: any[]) => mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige', applications, applicationsByPhase: {} })

describe('ApplicantsTab · house toolbar (V14)', () => {
  it('renders the search box, the phase status filter and the add button in house order', () => {
    render(<ApplicantsTab vacancy={vacancy([])} />)
    expect(screen.getByPlaceholderText('applicants.searchPlaceholder')).toBeInTheDocument()
    expect(screen.getByTitle('filters.statusFilter')).toBeInTheDocument()
    // DRAWER-ADD-SHORT-1: the visible text collapses to the shared "new" word,
    // but the full label stays the accessible name/title.
    expect(screen.getByRole('button', { name: 'applicants.addApplication' })).toBeInTheDocument()
  })

  it('search narrows the applications list by candidate name', async () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('applicants.searchPlaceholder'), 'Jan')
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()
  })
})
