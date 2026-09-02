import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidateTab from './CandidateTab'
import { peekReturnTab } from './constants'
// CandidateTab statically imports the full candidate tab set, several of which
// pull in @/lib/datetime — which re-exports from @/i18n, so importing it (even
// unrendered, behind the loading state below) initialises the REAL i18n runtime
// for this test file (unlike a lighter drawer tab test, which sees raw keys).
// Use the real instance to compute expected strings instead of hardcoding NL text.
import i18n from '@/i18n'
import type { ApplicationDetail } from '@/types/application'

// The full candidate fetch (GET /candidates/{id}) is irrelevant to most tests
// here — the mock's `get` is overridden per-test where a resolved candidate is
// needed to reach a tab that can trigger onUpdate.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), patch: vi.fn(() => Promise.resolve()) },
  unwrap: (r: unknown) => r,
}))
// OPTIMISTIC-REVERT-1: the revert test asserts the error toast fired with the
// server's own message (extractApiError), mirroring useApplicationDrawerActions.test.ts.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// PATCH-MAP-1: the mock exposes onEditSave so a test can prove the SAME
// UI-patch -> API-body mapping (buildCandidatePatch) runs here as on the real
// candidate drawer — the whole point of the fix (a raw camelCase patch used
// to reach the API directly and get silently dropped by CandidateProfileRequest).
// OPTIMISTIC-REVERT-1: also renders the merged `c.placeOfBirth` so a test can
// observe the optimistic write AND its revert on a failed PATCH.
vi.mock('@/pages/candidates/drawer/ProfilePanel', () => ({
  default: ({ c, onEditSave }: { c?: { placeOfBirth?: string }; onEditSave?: (v: Record<string, unknown>) => void }) => (
    <div>
      profile-panel
      <span data-testid="place-of-birth">{c?.placeOfBirth || 'none'}</span>
      <button onClick={() => onEditSave?.({ placeOfBirth: 'Rotterdam', zzp: { chamberOfCommerce: '123' } })}>save-edit</button>
    </div>
  ),
}))

// Minimal application detail — only the fields CandidateTab's header reads.
const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, candidateId: 7,
  candidate: {
    name: 'Jan Jansen', initials: 'JJ', function: '',
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    statusLabel: 'Beschikbaar', statusColor: '#2E7D32',
    gender: '', nationality: '', dob: '', email: '', phone: '', address: '', summary: '',
  },
  candidateStatus: 'available', candidatePhase: 'candidate',
  ...over,
} as unknown as ApplicationDetail)

// CandidateTab now fetches the candidate via useQuery (REFRESH-FIX-2) — every
// render needs a QueryClientProvider. `queryClient` is exposed so a test can
// drive/observe cache invalidation directly.
let queryClient: QueryClient
const renderTab = (app_: ApplicationDetail) =>
  render(<QueryClientProvider client={queryClient}><CandidateTab application={app_} /></QueryClientProvider>)

describe('CandidateTab', () => {
  // Default: the nested candidate fetch never resolves — most tests here only
  // assert the header, which renders before it settles. Tests that need the
  // full candidate (to reach a tab and fire onUpdate) override mockGet below.
  beforeEach(() => {
    mockGet.mockReset(); mockGet.mockReturnValue(new Promise(() => {}))
    mockPatch.mockReset(); mockPatch.mockResolvedValue({ data: { data: {} } })
    vi.mocked(notifyError).mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('shows the candidate name WITHOUT a status chip (Danny 21-07: the drawer header already carries the application status)', () => {
    renderTab(app())
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    // No second (candidate-deployability) status chip here — that read as "two statuses".
    expect(screen.queryByTestId('status-chip')).not.toBeInTheDocument()
    expect(screen.queryByText('Beschikbaar')).not.toBeInTheDocument()
    // The nested fetch never resolves in this test — the tab body stays the loading state.
    expect(screen.getByText(i18n.t('applications:candidateDetail.loading'))).toBeInTheDocument()
  })

  // Danny 21-07: "Open candidate" must be a REAL new-tab anchor (href + target=_blank),
  // not the in-app EntityLink button it used to be wrapped in.
  it('links to the full candidate record via a real new-tab anchor', () => {
    renderTab(app())
    const openLink = screen.getByTitle(i18n.t('applications:drawer.openCandidate'))
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=7')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // S14/S22: clicking through to the full candidate stashes 'candidate' as the
  // return tab, so browser BACK reopens this application's drawer on Kandidaat.
  it('stashes the return tab before navigating to the full candidate', async () => {
    const user = userEvent.setup()
    renderTab(app({ id: 42 }))
    await user.click(screen.getByTitle(i18n.t('applications:drawer.openCandidate')))
    expect(peekReturnTab(42)).toBe('candidate')
  })

  // PATCH-MAP-1 (audit finding, confirmed HIGH): onUpdate used to PATCH the raw
  // camelCase UI patch directly, which CandidateProfileRequest silently drops
  // (dob, placeOfBirth, houseNumber(+suffix), postalCode, linkedin, candidateTypes,
  // zzp, consent.retentionOptIn, ...) while the drawer optimistically showed
  // "saved". Assert the REQUEST BODY goes through buildCandidatePatch's mapping —
  // not merely that patch was called.
  it('persists a ProfilePanel edit via buildCandidatePatch (place_of_birth / freelance), not the raw camelCase patch', async () => {
    mockGet.mockResolvedValue({ id: 7, name: 'Jan Jansen' }) // this file's unwrap mock is identity (no axios envelope)
    const user = userEvent.setup()
    renderTab(app())
    await user.click(await screen.findByText('save-edit'))
    expect(mockPatch).toHaveBeenCalledWith('/candidates/7', {
      place_of_birth: 'Rotterdam',
      freelance: { chamberOfCommerce: '123' },
    })
  })

  // Empty mapped body (e.g. an unmapped/no-op patch) must not fire a PATCH at
  // all — mirrors useCandidateRecord().patchCandidate's same skip-if-empty guard.
  it('skips the PATCH entirely when the mapped body is empty', async () => {
    mockGet.mockResolvedValue({ id: 7, name: 'Jan Jansen' }) // this file's unwrap mock is identity (no axios envelope)
    renderTab(app())
    await screen.findByText('profile-panel')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  // OPTIMISTIC-REVERT-1 (audit 2026-07-28): onUpdate used to `.catch(() =>
  // notifyError(...))` with NO revert, so a rejected PATCH left the edited value
  // in `edits` forever, looking saved — `edits` is a sparse delta merged over the
  // fetched candidate, so a naive revert (setting the key back to `undefined`)
  // would ALSO have been wrong (it would still win the merge over the real
  // fetched value). A manually-controlled PATCH promise proves the full round
  // trip: the optimistic write shows BEFORE the server responds, then the
  // rejection restores the pre-edit (absent) value and surfaces its own message.
  it('reverts the optimistic edit and reports the server message when the PATCH FAILS', async () => {
    mockGet.mockResolvedValue({ id: 7, name: 'Jan Jansen' }) // no place_of_birth on the fetched record
    let rejectPatch!: (err: unknown) => void
    mockPatch.mockReturnValue(new Promise((_resolve, reject) => { rejectPatch = reject }))
    const user = userEvent.setup()
    renderTab(app())
    // Before the edit — the fetched candidate carries no place of birth.
    expect((await screen.findByTestId('place-of-birth')).textContent).toBe('none')
    await user.click(screen.getByText('save-edit'))
    // Optimistic write shows immediately — the PATCH promise is still pending.
    expect(screen.getByTestId('place-of-birth').textContent).toBe('Rotterdam')
    // Now the server rejects it — the failure must revert the shown value, never
    // let it stay on screen as if it had saved.
    await act(async () => { rejectPatch({ response: { data: { message: 'Ongeldige geboorteplaats' } } }) })
    await waitFor(() => expect(screen.getByTestId('place-of-birth').textContent).toBe('none'))
    expect(notifyError).toHaveBeenCalledWith('Ongeldige geboorteplaats')
  })

  // REFRESH-FIX-2: a successful onUpdate PATCH reconciles the candidates +
  // applications caches — a field edited here must not leave the application
  // drawer's OTHER surfaces (list rows, header pencil) showing the stale value.
  it('invalidates the candidates and applications caches after a successful onUpdate PATCH', async () => {
    mockGet.mockResolvedValue({ id: 7, name: 'Jan Jansen' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const user = userEvent.setup()
    renderTab(app())
    await user.click(await screen.findByText('save-edit'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1))
    const predicate = (invalidateSpy.mock.calls[0][0] as unknown as { predicate: (q: { queryKey: unknown[] }) => boolean }).predicate
    expect(predicate({ queryKey: ['candidates', 7] })).toBe(true)
    expect(predicate({ queryKey: ['candidates', 'stats', {}] })).toBe(false)
  })

  // REFRESH-FIX-2: CandidateTab's own fetch is a real useQuery keyed
  // ['candidates', candidateId] — invalidating the ['candidates'] prefix (as
  // the candidate drawer's own save site now does) must refetch it, so an edit
  // made on the OTHER surface shows up here without an F5.
  it('refetches the candidate once the candidates cache is invalidated, and the tab title follows the NEW name', async () => {
    mockGet.mockResolvedValueOnce({ id: 7, name: 'Jan Jansen' }).mockResolvedValueOnce({ id: 7, name: 'Jan van Jansen' })
    renderTab(app())
    await screen.findByText('profile-panel')
    expect(mockGet).toHaveBeenCalledTimes(1)
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['candidates'] }) })
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // Opus F1: the title must read the query result — the application's own
    // candidate.name snapshot (fixture: 'Jan Jansen') is never renamed by a pencil save.
    await waitFor(() => expect(screen.getByText('Jan van Jansen')).toBeInTheDocument())
  })

// S33 (02-09, TIJDLIJN-OVERAL sync): the embedded Kandidaat tab carries the same
// Tijdlijn tab as CandidateDrawer, second-to-last with Statistieken last.
describe('CandidateTab · timeline tab (S33)', () => {
  it('offers Tijdlijn second-to-last, before Statistieken', async () => {
    mockGet.mockResolvedValue({ id: 7, name: 'Jan Jansen' }) // identity unwrap mock, see above
    renderTab(app())
    await screen.findByText('profile-panel')
    const tabs = screen.getAllByRole('tab').map(el => el.textContent?.trim() ?? '')
    const timelineIdx = tabs.findIndex(t => /Tijdlijn|Timeline|drawer\.tabs\.timeline/.test(t))
    expect(timelineIdx).toBeGreaterThan(-1)
    expect(timelineIdx).toBe(tabs.length - 2)
  })
})
})
