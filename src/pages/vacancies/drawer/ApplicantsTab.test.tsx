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
vi.mock('@/pages/candidates/drawer/AddApplicationModal', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/DetachApplicationModal', () => ({ default: () => null }))
// Reused row (S-vacapp-1) pulls in useDateFormat, which pulls in the real i18n
// init — mocked out exactly like WorkTab.test.tsx so this file stays on the
// same "untranslated raw key" test convention as the rest of this suite.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))

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

// V-count-1: the per-phase breakdown chips above the list become clickable
// filters onto the SAME phase filter the toolbar's StatusFilterSelect drives.
describe('ApplicantsTab · phase chips are clickable filters (V-count-1)', () => {
  it('clicking a phase chip narrows the list to that phase and marks it active', async () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'hired' } },
    ])} />)

    const appliedChip = screen.getByRole('button', { name: /^Applied/ })
    const hiredChip = screen.getByRole('button', { name: /^Hired/ })
    expect(appliedChip).toHaveAttribute('aria-pressed', 'false')
    expect(hiredChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()

    await userEvent.click(appliedChip)

    expect(appliedChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()

    // Clicking again clears the filter — both applicants show again.
    await userEvent.click(appliedChip)
    expect(appliedChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()
  })
})

// S-vacapp-1: the applicant row REUSES the candidate drawer's own ApplicationRow
// (record EntityLink, pencil-edit, reason-gated unlink, lazy detail, pagination)
// — never a second, forked row implementation.
describe('ApplicantsTab · reuses the candidate drawer ApplicationRow (S-vacapp-1)', () => {
  it('links each row to the APPLICATION record (not a second, forked link)', () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    // The reused row's own accessible "open in new tab" affordance proves
    // ApplicationRow (not a hand-rolled row) rendered for this applicant.
    expect(screen.getAllByTitle('openInNewTab').length).toBeGreaterThan(0)
  })

  it('hides pencil/unlink without applications.update, shows them with it', async () => {
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
    const { default: NoPerm } = await import('./ApplicantsTab')
    const { unmount } = render(<NoPerm vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.queryByTitle('work.editApplication')).toBeNull()
    expect(screen.queryByTitle('work.detachApplication')).toBeNull()
    unmount()

    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
    const { default: WithPerm } = await import('./ApplicantsTab')
    render(<WithPerm vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.getByTitle('work.editApplication')).toBeInTheDocument()
    expect(screen.getByTitle('work.detachApplication')).toBeInTheDocument()
  })

  it('paginates at 5 rows per page (mirrors WorkTab)', async () => {
    const apps = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`, candidate_id: `c${i}`, candidate_name: `Candidate ${i}`, phase: { value: 'applied' },
    }))
    render(<ApplicantsTab vacancy={vacancy(apps)} />)
    expect(screen.getByText('Candidate 0')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 5')).toBeNull()
    await userEvent.click(screen.getByText('›'))
    expect(screen.getByText('Candidate 5')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 0')).toBeNull()
  })
})
