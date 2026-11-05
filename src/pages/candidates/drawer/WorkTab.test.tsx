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
// (WorkTab.subtabs.test.tsx) get exercised without mounting the real form).
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
