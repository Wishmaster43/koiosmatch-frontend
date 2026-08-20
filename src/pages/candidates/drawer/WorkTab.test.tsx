import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
// punt 7's detach asserts the exact method/route/body.
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
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
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

// Default: a recruiter WITH applications.update (pencil + unlink visible). The
// permission test below overrides it.
beforeEach(() => {
  vi.mocked(api.delete).mockClear()
  vi.mocked(api.get).mockClear()
  openEntity.mockClear()
  vi.mocked(notifyError).mockClear()
  vi.mocked(useAuth).mockReturnValue({ hasPermission: (p: string) => p === 'applications.update' } as unknown as ReturnType<typeof useAuth>)
})

describe('WorkTab', () => {
  it('links the row title to the APPLICATION record (punt 5)', () => {
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

  it('keeps the vacancy\'s own external URL (isSafeUrl-gated) on its icon link', () => {
    // Punt 5 moved the TITLE to the application record, so the vacancy's public URL
    // now lives only on its own ⧉ icon at the end of the row — still isSafeUrl-gated.
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige', url: 'https://example.com/vacancy' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByRole('link', { name: 'work.openVacancy' })).toHaveAttribute('href', 'https://example.com/vacancy')
  })

  it('drops an unsafe vacancy URL instead of rendering it (AUDIT-2)', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige', url: 'javascript:alert(1)' }, created_at: '2026-07-01' }])} />)
    expect(screen.queryByRole('link', { name: 'work.openVacancy' })).toBeNull()
  })
})

/**
 * Danny punt 5 (08-08): "na + sollicitatie zie ik geen hyperlink met icoon naar de
 * sollicitatie, en geen potloodje om te bewerken". The row now carries both, in the
 * house shape: the shared EntityLink (name = in-app, trailing icon = new window)
 * plus a pencil that reopens the application form in EDIT mode.
 */
describe('WorkTab · application row link + pencil (Danny punt 5)', () => {
  const oneApp = [{ id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' }]

  it('opens the APPLICATION in-app when the title is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(oneApp)} />)
    await user.click(screen.getByRole('button', { name: 'Verpleegkundige' }))
    expect(openEntity).toHaveBeenCalledWith('applications', 'app-1')
  })

  it('the trailing icon deep-links to the same application in a new window', () => {
    render(<WorkTab c={candidate(oneApp)} />)
    const icon = screen.getByRole('link', { name: 'openInNewTab' })
    expect(icon.getAttribute('href')).toContain('#applications?open=app-1')
    expect(icon).toHaveAttribute('target', '_blank')
    expect(icon).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('the pencil reopens the application form with editApplicationId set', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(oneApp)} />)
    await user.click(screen.getByRole('button', { name: 'work.editApplication' }))
    expect(screen.getByTestId('application-modal')).toHaveAttribute('data-edit-application-id', 'app-1')
  })

  it('hides the pencil AND the unlink entirely without applications.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    render(<WorkTab c={candidate(oneApp)} />)
    expect(screen.queryByRole('button', { name: 'work.editApplication' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'work.detachApplication' })).toBeNull()
    // The link itself is a read action — it stays.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
  })
})

/**
 * Danny punt 7 (08-08): "bij sollicitatie moet je ook vanuit de kandidaat kunnen
 * ontkoppelen". MEASURED LIVE against the API on 08-08 — DELETE /applications/{id}
 * answers 422 {"message":"The reason field is required."} without a body and 204
 * with `{"reason":"…"}` — so these tests assert the exact METHOD, ROUTE and BODY
 * (§13: the bulk-unlink that was green in tests and dead in production).
 */
describe('WorkTab · detach an application from the candidate (Danny punt 7)', () => {
  const oneApp = [{ id: 'app-1', vacancy: { id: 'vac-1', title: 'Verpleegkundige' }, created_at: '2026-07-01' }]

  // Open the reason prompt and confirm it with `reason`.
  const detachWithReason = async (reason: string) => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(oneApp)} />)
    await user.click(screen.getByRole('button', { name: 'work.detachApplication' }))
    await user.type(screen.getByLabelText('work.detachReasonLabel'), reason)
    await user.click(screen.getByRole('button', { name: 'work.detachConfirm' }))
    return user
  }

  it('DELETEs /applications/{id} with the REQUIRED reason body', async () => {
    await detachWithReason('Kandidaat trok zich terug')
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/applications/app-1', { data: { reason: 'Kandidaat trok zich terug' } }))
  })

  it('never fires the DELETE without a reason (the backend 422s on an empty body)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(oneApp)} />)
    await user.click(screen.getByRole('button', { name: 'work.detachApplication' }))
    expect(screen.getByRole('button', { name: 'work.detachConfirm' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'work.detachConfirm' }))
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('refreshes the candidate after a successful detach', async () => {
    await detachWithReason('Niet geschikt')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates/9'))
  })

  it('surfaces the server message and keeps the row on a failed detach (never a fake success)', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { data: { message: 'Geen rechten' } } })
    await detachWithReason('Niet geschikt')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Geen rechten'))
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
  })

  it('hides the detach action for a viewer without applications.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    render(<WorkTab c={candidate(oneApp)} />)
    expect(screen.queryByRole('button', { name: 'work.detachApplication' })).toBeNull()
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
    // Icon-only add trigger (28-07): the label is now its accessible name.
    expect(screen.getByRole('button', { name: 'sections.poolAdd' })).toBeInTheDocument()
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

// Danny live review, 04-08: "Zoeken en status erbij!" — the Sollicitaties list
// gets the same search + stage-filter toolbar idiom as the customer drill-down,
// on the SAME line as the two existing action buttons; plus column headers for
// the stage pill / applied-on date the header row was missing.
describe('WorkTab · Sollicitaties toolbar (search + stage filter, Danny live review 04-08)', () => {
  const twoApps = [
    { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
    { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageLabel: 'Ingepland', created_at: '2026-07-02' },
  ]

  it('renders search, stage filter and the two actions on ONE line, in that DOM order', () => {
    render(<WorkTab c={candidate(twoApps)} />)
    const search = screen.getByPlaceholderText('work.searchPlaceholder')
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    const stageFilter = screen.getByRole('button', { name: 'filters.status' })
    const applyButton = screen.getByRole('button', { name: 'work.addApplication' })
    const intakeButton = screen.getByRole('button', { name: 'work.planIntake' })
    expect(search.compareDocumentPosition(stageFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stageFilter.compareDocumentPosition(applyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(applyButton.compareDocumentPosition(intakeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('search narrows the visible applications on the vacancy label', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(twoApps)} />)
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('work.searchPlaceholder'), 'verzorg')
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
  })

  it('the stage filter (derived from the loaded rows) narrows to the picked stage only', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(twoApps)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    await user.click(await screen.findByRole('button', { name: 'Ingepland' }))
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
  })

  it('renders column headers for Vacature, Status and Datum (Danny live review: "geen kopje?")', () => {
    render(<WorkTab c={candidate(twoApps)} />)
    expect(screen.getByText('work.vacancy')).toBeInTheDocument()
    expect(screen.getByText('work.colStatus')).toBeInTheDocument()
    expect(screen.getByText('work.colDate')).toBeInTheDocument()
  })
})

/**
 * S-cand-1: the stage filter now groups/filters on `stageKey` when the backend
 * embed carries it, so a tenant renaming a stage's LABEL never silently splits
 * one stage into two filter buckets — falls back to stageLabel while any row
 * still predates the embed (rollout-safe).
 */
describe('WorkTab · S-cand-1 stage filter uses stageKey (label fallback)', () => {
  it('two rows sharing one stageKey but different (renamed) labels stay ONE filter bucket', async () => {
    const rows = [
      { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageKey: 'applied', stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
      { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageKey: 'applied', stageLabel: 'Sollicitatie ontvangen', created_at: '2026-07-02' },
    ]
    const user = userEvent.setup()
    render(<WorkTab c={candidate(rows)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    // Only ONE stage option in the menu — not two, despite the differing labels.
    expect(screen.getAllByRole('button', { name: /Gesolliciteerd|Sollicitatie ontvangen/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /Gesolliciteerd|Sollicitatie ontvangen/ }))
    // Picking that one bucket keeps BOTH rows.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
  })

  it('still filters correctly by label when stageKey is absent (pre-rollout rows)', async () => {
    const rows = [
      { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
      { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageLabel: 'Ingepland', created_at: '2026-07-02' },
    ]
    const user = userEvent.setup()
    render(<WorkTab c={candidate(rows)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    await user.click(await screen.findByRole('button', { name: 'Ingepland' }))
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
  })
})

/**
 * Danny 09-08: "de koppen staan niet boven hun eigen kolom" — the header used
 * to declare its own fixed widths while ApplicationRow built its cells
 * completely differently (a pill with its own intrinsic width, a date with
 * only `flexShrink: 0`), and the header had no column at all for the trailing
 * pencil/unlink/external-link/chevron cluster. Both sides now read their
 * widths from the SAME shared module (applicationRowColumns.ts) — these tests
 * compare the ACTUAL rendered header cell to the ACTUAL rendered row cell
 * (not just to the imported constant), so a future hardcoded, divergent
 * number on either side breaks this instead of silently drifting apart again.
 */
describe('WorkTab · Sollicitaties header/row share ONE column geometry (Danny 09-08)', () => {
  const oneApp = [{ id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' }]

  it('renders an (empty) header cell above the actions column (Danny: "lege kop boven de actiekolom")', () => {
    render(<WorkTab c={candidate(oneApp)} />)
    expect(screen.getByTestId('app-col-actions-header')).toBeInTheDocument()
  })

  it('status/date/actions column widths are IDENTICAL between the header and the row', () => {
    render(<WorkTab c={candidate(oneApp)} />)
    const statusHeader = screen.getByText('work.colStatus')
    const dateHeader = screen.getByText('work.colDate')
    const actionsHeader = screen.getByTestId('app-col-actions-header')
    // The stage pill's own wrapping cell (StatusPill's text is the pill's OWN
    // direct text child, so its immediate parent is ApplicationRow's column span).
    const statusCell = screen.getByText('Gesolliciteerd').parentElement as HTMLElement
    const dateCell = screen.getByText('fmt(2026-07-01)')
    const actionsCell = screen.getByTestId('app-col-actions')
    expect(statusCell.style.width).toBe(statusHeader.style.width)
    expect(dateCell.style.width).toBe(dateHeader.style.width)
    expect(actionsCell.style.width).toBe(actionsHeader.style.width)
  })
})
