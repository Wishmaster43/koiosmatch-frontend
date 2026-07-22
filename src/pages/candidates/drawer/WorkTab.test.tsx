import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkTab from './WorkTab'
import api from '@/lib/api'
import type { Candidate } from '@/types/candidate'

// The candidate's appointments fetch (a sibling structured entity) is irrelevant
// to the vacancy-title/created-date row this test covers.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))
// sectionBlock (styling) + the NAV-BACK-1 helpers MatchesTab imports from the same module.
vi.mock('./constants', () => ({ sectionBlock: {}, rememberReturnTab: vi.fn(), peekReturnTab: () => null, clearReturnTab: () => {} }))
// The shared appointment modal is a different file's scope (its own lookups/auth/
// vacancy-options hooks) — stand in with a marker exposing the props INTAKE-
// VACANCY-ID-1 cares about, so the wiring is observable without those hooks.
vi.mock('./PlanIntakeModal', () => ({
  default: ({ defaultVacancyId, existing }: { defaultVacancyId?: string | number | null; existing?: { vacancy_id?: string | number | null } }) => (
    <div data-testid="plan-intake-modal" data-default-vacancy-id={defaultVacancyId ?? ''} data-existing-vacancy-id={existing?.vacancy_id ?? ''} />
  ),
}))

const candidate = (applications: unknown[]): Candidate => ({ id: 9, matches: [], applications } as unknown as Candidate)

describe('WorkTab', () => {
  it('links the vacancy title internally (EntityLink) when there is an id but no external url', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
  })

  it('shows the application created date (APP-EMBED-1)', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByText('fmt(2026-07-01)')).toBeInTheDocument()
  })

  it('shows a dash for a genuinely vacancy-less row (no title, no id, no url)', () => {
    render(<WorkTab c={candidate([{ id: 'a1' }])} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows a dash for the created date when genuinely missing', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' } }])} />)
    // Two dashes render for a title-only row with no created_at: none from the title,
    // one from the date. Assert the formatted date is NOT rendered instead of a count,
    // since the vacancy-less test above already covers the dash count.
    expect(screen.queryByText(/fmt\(/)).toBeNull()
  })

  it('preserves the existing external-URL link (isSafeUrl-gated) untouched', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige', url: 'https://example.com/vacancy' }, created_at: '2026-07-01' }])} />)
    const anchor = screen.getByRole('link', { name: 'Verpleegkundige' })
    expect(anchor).toHaveAttribute('href', 'https://example.com/vacancy')
  })
})

// Kandidaten-ronde-2, punt C: Sollicitaties · Matches · Talentenpools sub-tabs —
// the two application actions and the "+ Match" button move INTO their own
// sub-tab instead of sharing one header row. This file doesn't initialise real
// i18n (react-i18next isn't mocked, and `@/lib/datetime` — the module other
// candidate tests piggyback real i18n init on — IS mocked away here), so `t()`
// resolves to the raw key, same as AddApplicationModal.test.tsx; assertions
// below match on those raw keys, not translated Dutch text.
describe('WorkTab · sub-tabs (kandidaten-ronde-2, punt C)', () => {
  it('defaults to the Sollicitaties sub-tab, with both its actions visible', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByRole('tab', { name: 'sections.applications' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'work.addApplication' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'work.planIntake' })).toBeInTheDocument()
    // The Matches/Talentenpools content isn't mounted until their sub-tab is picked.
    expect(screen.queryByRole('button', { name: 'work.addMatch' })).toBeNull()
  })

  it('the Matches sub-tab shows the "+ Match" button (moved from the shared header)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    expect(screen.getByRole('button', { name: 'work.addMatch' })).toBeInTheDocument()
    expect(screen.getByText('matchesView.empty')).toBeInTheDocument()
    // Sollicitaties' own actions are gone once its sub-tab isn't active.
    expect(screen.queryByRole('button', { name: 'work.addApplication' })).toBeNull()
  })

  it('the Talentenpools sub-tab renders the pools section (moved here from Profiel)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.pools' }))
    expect(screen.getByText('sections.poolAdd')).toBeInTheDocument()
  })

  it('sorts the sub-tabs alphabetically by (translated) label', () => {
    render(<WorkTab c={candidate([])} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['sections.applications', 'sections.placements', 'sections.pools'])
  })
})

// INTAKE-VACANCY-ID-1 (CMBE VAC-LEADS-1): the vacancy leads-list is computed from
// intake appointments carrying `vacancy_id` — a "Intake plannen" booked from the
// candidate side must thread that id whenever it is unambiguous.
describe('WorkTab · INTAKE-VACANCY-ID-1 (vacancy_id wiring for the shared appointment modal)', () => {
  it('defaults "Intake plannen" to the single distinct vacancy across the applications', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([{ id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    await user.click(screen.getByRole('button', { name: 'work.planIntake' }))
    expect(screen.getByTestId('plan-intake-modal')).toHaveAttribute('data-default-vacancy-id', 'vac-1')
  })

  it('leaves the default empty when the candidate has two DIFFERENT vacancies (ambiguous — the modal picker decides)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([
      { id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' },
      { id: 'app-2', vacancy: { id: 'vac-2', title: 'Verzorgende' }, created_at: '2026-07-02' },
    ])} />)
    await user.click(screen.getByRole('button', { name: 'work.planIntake' }))
    expect(screen.getByTestId('plan-intake-modal')).toHaveAttribute('data-default-vacancy-id', '')
  })

  it('leaves the default empty for a genuinely vacancy-less candidate (CONSIST-2)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([{ id: 'app-1', created_at: '2026-07-01' }])} />)
    await user.click(screen.getByRole('button', { name: 'work.planIntake' }))
    expect(screen.getByTestId('plan-intake-modal')).toHaveAttribute('data-default-vacancy-id', '')
  })

  it('edits an intake appointment with the ROW\'S VACANCY id, never the application\'s own id', async () => {
    // Regression: the pencil used to pass the application's own row id as `vacancy_id`
    // (a copy-paste of the wrong local), corrupting the appointment on save.
    vi.mocked(api.get).mockImplementation((url: unknown) => {
      if (String(url).includes('/appointments')) {
        return Promise.resolve({ data: { data: [{ id: 'appt-1', application_id: 'app-1', type: 'intake', scheduled_at: '2026-07-20T10:00:00Z', duration_min: 30, modality: 'office', owner: { id: 'u1', name: 'Piet' } }] } })
      }
      return Promise.resolve({ data: { data: [] } })
    })
    const user = userEvent.setup()
    render(<WorkTab c={candidate([{ id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    const editButton = await screen.findByRole('button', { name: 'work.editIntake' })
    await user.click(editButton)
    expect(screen.getByTestId('plan-intake-modal')).toHaveAttribute('data-existing-vacancy-id', 'vac-1')
  })
})
