import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

// PATCH-MAP-1: the mock exposes onEditSave so a test can prove the SAME
// UI-patch -> API-body mapping (buildCandidatePatch) runs here as on the real
// candidate drawer — the whole point of the fix (a raw camelCase patch used
// to reach the API directly and get silently dropped by CandidateProfileRequest).
vi.mock('@/pages/candidates/drawer/ProfilePanel', () => ({
  default: ({ onEditSave }: { onEditSave?: (v: Record<string, unknown>) => void }) => (
    <div>
      profile-panel
      <button onClick={() => onEditSave?.({ placeOfBirth: 'Rotterdam', zzp: { chamberOfCommerce: '123' } })}>save-edit</button>
    </div>
  ),
}))

// Minimal application detail — only the fields CandidateTab's header reads.
const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, candidateId: 7,
  candidate: {
    name: 'Jan Jansen', initials: 'JJ', function: '',
    statusLabel: 'Beschikbaar', statusColor: '#2E7D32',
    gender: '', nationality: '', dob: '', email: '', phone: '', address: '', summary: '',
  },
  candidateStatus: 'available', candidatePhase: 'candidate',
  ...over,
} as unknown as ApplicationDetail)

describe('CandidateTab', () => {
  // Default: the nested candidate fetch never resolves — most tests here only
  // assert the header, which renders before it settles. Tests that need the
  // full candidate (to reach a tab and fire onUpdate) override mockGet below.
  beforeEach(() => {
    mockGet.mockReset(); mockGet.mockReturnValue(new Promise(() => {}))
    mockPatch.mockReset(); mockPatch.mockResolvedValue({ data: { data: {} } })
  })

  it('shows the candidate name WITHOUT a status chip (Danny 21-07: the drawer header already carries the application status)', () => {
    render(<CandidateTab application={app()} />)
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
    render(<CandidateTab application={app()} />)
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
    render(<CandidateTab application={app({ id: 42 })} />)
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
    render(<CandidateTab application={app()} />)
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
    render(<CandidateTab application={app()} />)
    await screen.findByText('profile-panel')
    expect(mockPatch).not.toHaveBeenCalled()
  })
})
