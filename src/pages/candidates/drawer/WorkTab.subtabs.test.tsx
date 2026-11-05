/** WorkTab · sub-tabs, intake vacancy wiring and record refresh (split from WorkTab.test.tsx; raw-key i18n, no real init). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkTab from './WorkTab'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import type { Candidate } from '@/types/candidate'

// Hoisted so the navigation spy is the SAME function across renders (punt 5
// asserts WHICH entity the row title opens in-app).
const { openEntity } = vi.hoisted(() => ({ openEntity: vi.fn() }))

// The candidate's appointments fetch (a sibling structured entity) is irrelevant
// to the vacancy-title/created-date row this test covers. `delete` is real here:
// punt 7's detach (WorkTab.test.tsx) asserts the exact method/route/body.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    delete: vi.fn(() => Promise.resolve({ status: 204 })),
  },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }), useLocale: () => 'nl-NL' }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))
// The application form is a different file's scope (vacancy/stage/user lookups) —
// stand in with a marker exposing `editApplicationId`, so punt 5's pencil wiring is
// observable without mounting the real form (it has its own test file).
vi.mock('./AddApplicationModal', () => ({
  default: ({ editApplicationId }: { editApplicationId?: string | number | null }) => (
    <div data-testid="application-modal" data-edit-application-id={editApplicationId ?? ''} />
  ),
}))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))
// sectionBlock (styling) + the NAV-BACK-1 helpers MatchesTab imports from the same module.
vi.mock('./constants', () => ({ sectionBlock: {}, rememberReturnTab: vi.fn(), peekReturnTab: () => null, clearReturnTab: () => {} }))
// The shared appointment modal is a different file's scope (its own lookups/auth/
// vacancy-options hooks) — stand in with a marker exposing the props INTAKE-
// VACANCY-ID-1 cares about, so the wiring is observable without those hooks.
vi.mock('./PlanIntakeModal', () => ({
  default: ({ defaultVacancyId, suggestedVacancyId, existing }: { defaultVacancyId?: string | number | null; suggestedVacancyId?: string | number | null; existing?: { vacancy_id?: string | number | null } }) => (
    <div data-testid="plan-intake-modal" data-default-vacancy-id={defaultVacancyId ?? ''} data-suggested-vacancy-id={suggestedVacancyId ?? ''} data-existing-vacancy-id={existing?.vacancy_id ?? ''} />
  ),
}))
// MatchModal is a different file's scope (customer/vacancy/rate hooks) —
// stand in with a marker exposing `editMatchId` + a trigger button for `onCreated`
// (§13: this is how point 1's refresh-callback wiring and point 2's pencil wiring
// below get exercised without mounting the real form).
vi.mock('./MatchModal', () => ({
  default: ({ editMatchId, onCreated }: { editMatchId?: string | number | null; onCreated: () => void }) => (
    <div data-testid="match-modal" data-edit-match-id={editMatchId ?? ''}>
      <button onClick={onCreated}>trigger-match-created</button>
    </div>
  ),
}))

const candidate = (applications: unknown[], matches: unknown[] = []): Candidate => ({ id: 9, matches, applications } as unknown as Candidate)

// Default: a recruiter WITH applications.create + applications.update + matches.update
// (add + pencil + unlink + "+ Match" all visible). Individual tests override it where they test a narrower grant.
beforeEach(() => {
  vi.mocked(api.delete).mockClear()
  vi.mocked(api.get).mockClear()
  openEntity.mockClear()
  vi.mocked(notifyError).mockClear()
  vi.mocked(useAuth).mockReturnValue({ hasPermission: (p: string) => ['applications.create', 'applications.update', 'matches.update'].includes(p) } as unknown as ReturnType<typeof useAuth>)
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
    // Icon-only add trigger (28-07): the label is now its accessible name.
    expect(screen.getByRole('button', { name: 'sections.poolAdd' })).toBeInTheDocument()
  })

  it('sorts the sub-tabs alphabetically by (translated) label', () => {
    render(<WorkTab c={candidate([])} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['sections.applications', 'sections.placements', 'sections.pools'])
  })

  // RIGHTS-GATE-OPENERS-1: applications.create gates the "+ Solliciteren" and
  // "Intake plannen" openers — hidden without it, never a dead button (§3).
  it('hides both application openers without applications.create, shows them with it', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    const { rerender } = render(<WorkTab c={candidate([])} />)
    expect(screen.queryByRole('button', { name: 'work.addApplication' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'work.planIntake' })).toBeNull()

    vi.mocked(useAuth).mockReturnValue({ hasPermission: (p: string) => p === 'applications.create' } as unknown as ReturnType<typeof useAuth>)
    rerender(<WorkTab c={candidate([])} />)
    expect(screen.getByRole('button', { name: 'work.addApplication' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'work.planIntake' })).toBeInTheDocument()
  })

  // OPENERS-HIDE-1 (pass 5): "+ Match" → MatchModal → POST /matches, gated
  // matches.update (applications-matches.php:101-102). Hidden without the
  // permission, never a dead button (§3) — mirrors ScopedMatchesTab/MatchesTab.
  it('hides "+ Match" without matches.update, shows it with it', async () => {
    const user = userEvent.setup()
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    const { rerender } = render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    expect(screen.queryByRole('button', { name: 'work.addMatch' })).toBeNull()

    vi.mocked(useAuth).mockReturnValue({ hasPermission: (p: string) => p === 'matches.update' } as unknown as ReturnType<typeof useAuth>)
    rerender(<WorkTab c={candidate([])} />)
    expect(screen.getByRole('button', { name: 'work.addMatch' })).toBeInTheDocument()
  })
})

// INTAKE-VACANCY-ID-1 (CMBE VAC-LEADS-1): the vacancy leads-list is computed from
// intake appointments carrying `vacancy_id` — a "Intake plannen" booked from the
// candidate side must thread that id whenever it is unambiguous.
describe('WorkTab · INTAKE-VACANCY-ID-1 (vacancy_id wiring for the shared appointment modal)', () => {
  // KOIOS-VOORSTEL-1 (Danny 13-08): with exactly one distinct vacancy in the history,
  // both modals receive it as a MARKED Koios suggestion — not a silent default.
  it('threads the sole history vacancy into "Intake plannen" as a Koios SUGGESTION', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([{ id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    await user.click(screen.getByRole('button', { name: 'work.planIntake' }))
    const modal = screen.getByTestId('plan-intake-modal')
    expect(modal).toHaveAttribute('data-suggested-vacancy-id', 'vac-1')
    expect(modal).not.toHaveAttribute('data-default-vacancy-id', 'vac-1')
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

// Point 1 (Danny live P1 — "stale after match create"): a match/application/intake
// create used to only refresh WorkTab's OWN local apps/appts state, leaving the
// rest of the drawer (MatchesTab, header status, Ervaring) stale until reopen —
// `reload()` now ALSO calls the `onRefresh` prop, which CandidateDrawer wires to
// the page hook's `refreshRecord` (a pure GET+replace, never a PATCH).
describe('WorkTab · shared record refresh after create (point 1, Danny live P1)', () => {
  it('calls onRefresh in addition to its own local refetch after a match create', async () => {
    const onRefresh = vi.fn()
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} onRefresh={onRefresh} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    await user.click(screen.getByRole('button', { name: 'work.addMatch' }))
    await user.click(screen.getByRole('button', { name: 'trigger-match-created' }))
    // The shared-record refresh fires...
    expect(onRefresh).toHaveBeenCalledTimes(1)
    // ...alongside WorkTab's own existing local refetch (unchanged behaviour).
    expect(api.get).toHaveBeenCalledWith('/candidates/9')
  })

  it('still calls onRefresh when the host omits it (optional prop, no crash)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    await user.click(screen.getByRole('button', { name: 'work.addMatch' }))
    await user.click(screen.getByRole('button', { name: 'trigger-match-created' }))
    expect(api.get).toHaveBeenCalledWith('/candidates/9')
  })
})

// Point 2 (Danny live P1): the pencil on a MatchesTab row reopens the SAME modal
// with `editMatchId` set — WorkTab owns the state, MatchesTab only reports which
// row was clicked.
describe('WorkTab · pencil on a match row opens the edit modal (point 2)', () => {
  it('opens MatchModal with editMatchId set to the clicked row', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([], [{ id: 'match-7', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    expect(screen.getByTestId('match-modal')).toHaveAttribute('data-edit-match-id', 'match-7')
  })
})
