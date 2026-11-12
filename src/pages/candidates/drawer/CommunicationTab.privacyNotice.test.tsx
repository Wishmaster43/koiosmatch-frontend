/** CommunicationTab privacy notice acceptance line (real i18n, loaded lazily). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommunicationTab from './CommunicationTab'
import { invalidateRetentionConsentMonths } from './useRetentionConsentMonths'
import type { Candidate } from '@/types/candidate'
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

// K012-DOSSIER-LINE-1: real i18n is loaded lazily and LAST, so the key-echo cases above stay untouched.
describe('CommunicationTab · privacy notice acceptance line (K012-DOSSIER-LINE-1)', () => {
  const openConsent = async (extra: Partial<Candidate>) => {
    const { default: i18n } = await import('@/i18n')
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, extra)} />)
    await user.click(screen.getByRole('tab', { name: i18n.t('candidates:communication.consentTitle') }))
  }

  it('shows the date and the version when both are present', async () => {
    await openConsent({ privacyConsentedAt: '2026-10-02 09:30', privacyNoticeVersion: 'a1b2c3d4e5f6' } as Partial<Candidate>)
    expect(screen.getByText('Privacy notice accepted on 2026-10-02 09:30 (version a1b2c3d4e5f6)')).toBeInTheDocument()
  })

  it('shows the no-version variant when only the date is present', async () => {
    await openConsent({ privacyConsentedAt: '2026-10-02 09:30', privacyNoticeVersion: null } as Partial<Candidate>)
    expect(screen.getByText('Privacy notice accepted on 2026-10-02 09:30')).toBeInTheDocument()
  })

  it('renders no line when the notice was never accepted', async () => {
    await openConsent({ privacyConsentedAt: null, privacyNoticeVersion: null } as Partial<Candidate>)
    expect(screen.queryByText(/Privacy notice accepted/)).not.toBeInTheDocument()
  })
})
