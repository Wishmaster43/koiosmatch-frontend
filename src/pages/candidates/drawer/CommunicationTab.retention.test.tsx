/** CommunicationTab retention suite (AVG-RET-2). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommunicationTab from './CommunicationTab'
import { invalidateRetentionConsentMonths } from './useRetentionConsentMonths'
import { candidate } from './CommunicationTab.testKit'

// The retention block reads the tenant consent window from GET /settings; keep the
// named exports real (other modules in this tree import unwrapList & co).
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  default: { get: apiGet },
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
// AVG-RET-2: role-gate for the retention line — default to "no permission" so the
// pre-existing tests below (which never touch this mock) keep their original,
// permission-less behaviour; the retention describe block overrides per test.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
beforeEach(() => {
  mockUseAuth.mockReturnValue({ hasPermission: () => false })
  invalidateRetentionConsentMonths()
  apiGet.mockReset()
  apiGet.mockResolvedValue({ data: { retention_consent_months: '24' } })
  notesState.error = false
})
// Mutable per-test notes list (vi.hoisted so the mock factory below can read it) —
// the status-change pencil tests need a system note in the list; every other test
// keeps the original empty list.
const { notesState } = vi.hoisted(() => ({ notesState: { notes: [] as unknown[], error: false } }))
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => ({
    notes: notesState.notes, error: notesState.error, addNote: vi.fn(), editNote: vi.fn(), reload: vi.fn(),
  }),
}))
vi.mock('./CandidateTasks', () => ({ default: () => <div data-testid="candidate-tasks-stub" /> }))
// K-288: the linked-notes feed is now its own sub-tab (LinkedNotesTab), built in a
// parallel lane with its own suite — stub it here so this file never touches its
// internals (react-query, useNoteFeed, …).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({ default: () => <div data-testid="linked-notes-tab" /> }))

// AVG-RET-2 (Danny 22-07 punt 8): the read-only "Bewaren tot" summary + the
// disabled retention opt-in item. Role-gated on candidates.delete, mirroring
// CandidatesPage's archive/merge gate — hidden entirely without the permission
// (never an empty line), and the opt-in checkbox never interacts until CMBE-RET-A.
describe('CommunicationTab · retention (AVG-RET-2, Danny 22-07 punt 8)', () => {
  const openConsent = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))

  it('shows "Bewaren tot" with the deadline when the user has candidates.delete', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'candidates.delete' })
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { retentionExpiresAt: '2027-01-01' })} />)
    await openConsent(user)
    expect(screen.getByText(/retentionUntil/)).toBeInTheDocument()
  })

  it('falls back to the "unlimited" copy when opted in and no deadline is set', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'candidates.delete' })
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ retentionOptIn: true, retentionConsentAt: '2026-01-01' }, { retentionExpiresAt: null })} />)
    await openConsent(user)
    expect(screen.getByText(/retentionUnlimited/)).toBeInTheDocument()
  })

  it('falls back to the "unknown" copy when there is neither a deadline nor an opt-in', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'candidates.delete' })
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { retentionExpiresAt: null })} />)
    await openConsent(user)
    expect(screen.getByText(/retentionUnknown/)).toBeInTheDocument()
  })

  it('hides the retention line entirely for a user without candidates.delete (never blank)', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { retentionExpiresAt: '2027-01-01' })} />)
    await openConsent(user)
    expect(screen.queryByText(/retentionUntil|retentionUnlimited|retentionUnknown/)).toBeNull()
  })

  // CMBE-RET-A shipped (2026-07-22): the retention opt-in is a REAL toggle now,
  // same as the 3 channel checkboxes — no more disabled honest-gate.
  it('renders the retention opt-in as a working checkbox (CMBE-RET-A shipped)', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ retentionOptIn: true })} />)
    await openConsent(user)
    expect(screen.getByLabelText('communication.consentRetentionOptIn')).not.toBeDisabled()
  })

  it('toggling retention ON stamps the local retentionConsentAt immediately, mirroring the channel checkboxes', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ retentionOptIn: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getByLabelText('communication.consentRetentionOptIn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ retentionOptIn: true, retentionConsentAt: expect.any(String) }))
  })

  it('toggling retention OFF nulls the local retentionConsentAt so no stale date lingers', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ retentionOptIn: true, retentionConsentAt: '2026-01-01T00:00:00.000Z' })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getByLabelText('communication.consentRetentionOptIn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ retentionOptIn: false, retentionConsentAt: null }))
  })

  // "Bewaartoestemming verloopt" (Danny 2026-08-02): the tab must wire the block that
  // states the consent's OWN validity — a checked box next to a consent that lapsed
  // months ago is exactly the lie this project forbids. Date is faked (Date only, so
  // timers stay real for userEvent) to keep the lapse boundary deterministic.
  const withFakeNow = async (run: () => Promise<void>) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'))
    try { await run() } finally { vi.useRealTimers() }
  }

  it('states plainly that a lapsed consent has lapsed, right next to the opt-in box', async () => {
    await withFakeNow(async () => {
      const user = userEvent.setup()
      render(<CommunicationTab c={candidate({ retentionOptIn: true, retentionConsentAt: '2023-01-15T10:00:00.000Z' })} />)
      await openConsent(user)
      expect(await screen.findByText(/communication\.retentionConsentLapsed/)).toBeInTheDocument()
      expect(screen.queryByText(/communication\.retentionConsentValidUntil/)).toBeNull()
    })
  })

  it('shows until WHEN a still-valid consent holds', async () => {
    await withFakeNow(async () => {
      const user = userEvent.setup()
      render(<CommunicationTab c={candidate({ retentionOptIn: true, retentionConsentAt: '2026-01-15T10:00:00.000Z' })} />)
      await openConsent(user)
      expect(await screen.findByText(/communication\.retentionConsentValidUntil/)).toBeInTheDocument()
    })
  })
})
