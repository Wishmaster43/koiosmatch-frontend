/** CommunicationTab conversation suites: WhatsApp start, notes failure, linked notes, deep-link action, composer hint, auth loading. */
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

// WHATSAPP-COMPOSE-1 (Danny 06-08): the "Conversatie starten" trigger next to the
// Conversaties section — disabled with an honest title for a candidate without a
// mobile number (no dead sends, §3), enabled + opens the modal otherwise.
describe('CommunicationTab · WhatsApp start trigger (WHATSAPP-COMPOSE-1)', () => {
  const goToConversations = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'sections.conversations' }))

  // OPENERS-HIDE-1 (pass 5): this describe's own trigger tests need page.whatsapp
  // (the file's own top-level beforeEach otherwise defaults hasPermission to false).
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' })
  })

  it('disables the trigger with an honest title when the candidate has no mobile number', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await goToConversations(user)
    expect(screen.getByTitle('conversations.startNoMobile')).toBeDisabled()
  })

  it('enables the trigger once the candidate has a mobile number', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} />)
    await goToConversations(user)
    expect(screen.getByRole('button', { name: 'conversations.start' })).not.toBeDisabled()
  })

  // D8: mapCandidate.ts writes '-' as the display placeholder for a missing
  // mobile number, which is truthy — the gate must treat it as empty too.
  it('disables the trigger for the mapper\'s "-" placeholder, not just a falsy value', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '-' })} />)
    await goToConversations(user)
    expect(screen.getByTitle('conversations.startNoMobile')).toBeDisabled()
  })

  it('opens the start-conversation modal on click', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} />)
    await goToConversations(user)
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))
    expect(screen.getByRole('dialog', { name: 'conversations.startModalTitle' })).toBeInTheDocument()
  })

  // OPENERS-HIDE-1 (pass 5): POST /conversations/start is gated on page.whatsapp
  // (communication-ai.php:76-80). Hidden without the permission, shown with it.
  it('hides "Conversatie starten" without page.whatsapp', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} />)
    await goToConversations(user)
    expect(screen.queryByRole('button', { name: 'conversations.start' })).toBeNull()
  })

  it('shows "Conversatie starten" with page.whatsapp', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' })
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} />)
    await goToConversations(user)
    expect(screen.getByRole('button', { name: 'conversations.start' })).toBeInTheDocument()
  })
})

// BUG-HUNT-CLASS-B: a failed notes GET must surface a real, retryable notice —
// never render as a silently empty thread indistinguishable from "no notes".
describe('CommunicationTab · notes load failure (Class B)', () => {
  it('shows no error notice when the notes GET succeeded (even if empty)', () => {
    notesState.error = false
    render(<CommunicationTab c={candidate()} />)
    expect(screen.queryByText('communication.notesLoadError')).not.toBeInTheDocument()
  })

  it('shows the error notice with a retry action when the notes GET failed', () => {
    notesState.error = true
    render(<CommunicationTab c={candidate()} />)
    expect(screen.getByText('communication.notesLoadError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:error.retry' })).toBeInTheDocument()
  })
})

// K-288: the linked-notes feed moved out of the Notities section into its own
// sub-tab, right after Notities — same deep-link validation as every other tab.
describe('CommunicationTab · linkedNotes sub-tab (K-288)', () => {
  it('renders the LinkedNotesTab stub when the sub-tab is clicked', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'sections.linkedNotes' }))
    expect(screen.getByTestId('linked-notes-tab')).toBeInTheDocument()
  })

  it('lands on linkedNotes via the deep-link initialSubTab prop', () => {
    render(<CommunicationTab c={candidate()} initialSubTab="linkedNotes" />)
    expect(screen.getByTestId('linked-notes-tab')).toBeInTheDocument()
  })

  it('the Notities sub-tab no longer renders the linked-notes feed inline', () => {
    render(<CommunicationTab c={candidate()} />)
    expect(screen.queryByTestId('linked-notes-tab')).not.toBeInTheDocument()
  })
})

// CONVERSATION-START-1: a Koios "message this person" deep link (tab:sub:action)
// opens the start-conversation modal on mount instead of landing on plain Notes.
describe('CommunicationTab · initialAction=start (CONVERSATION-START-1)', () => {
  // The deep link only opens the modal when both trigger gates the '+ conversation'
  // button itself enforces are satisfied (page.whatsapp + a real mobile number) —
  // otherwise the render gate must keep it closed even with action=start (§3 no
  // fake affordance: the Koios path opens the drawer on a stub candidate first).
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' })
  })

  it('opens the start-conversation modal on mount when sub-tab is conversations and action is start', () => {
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" initialAction="start" />)
    expect(screen.getByRole('dialog', { name: 'conversations.startModalTitle' })).toBeInTheDocument()
  })

  it('does not open the modal without the action', () => {
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" />)
    expect(screen.queryByRole('dialog', { name: 'conversations.startModalTitle' })).not.toBeInTheDocument()
  })

  it('does not open the modal when the sub-tab is notes, even with action=start', () => {
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="notes" initialAction="start" />)
    expect(screen.queryByRole('dialog', { name: 'conversations.startModalTitle' })).not.toBeInTheDocument()
  })

  it('does not open the modal without page.whatsapp, even with action=start (dead-send gate)', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" initialAction="start" />)
    expect(screen.queryByRole('dialog', { name: 'conversations.startModalTitle' })).not.toBeInTheDocument()
  })

  it('does not open the modal without a mobile number, even with action=start (dead-send gate)', () => {
    render(<CommunicationTab c={candidate()} initialSubTab="conversations" initialAction="start" />)
    expect(screen.queryByRole('dialog', { name: 'conversations.startModalTitle' })).not.toBeInTheDocument()
  })

  it('consumes the action when page.whatsapp is missing, so a later gate flip opens no stale modal', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    const onConsumed = vi.fn()
    const { rerender } = render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" initialAction="start" onInitialActionConsumed={onConsumed} />)
    expect(onConsumed).toHaveBeenCalled()
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' })
    rerender(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" initialAction="start" onInitialActionConsumed={onConsumed} />)
    expect(screen.queryByRole('dialog', { name: 'conversations.startModalTitle' })).not.toBeInTheDocument()
  })
})

// K-008 composer notice: the thread composer shows the hint only for due === true.
describe('CommunicationTab · privacy notice hint in the thread composer (K-008)', () => {
  beforeEach(() => { mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' }) })
  const THREAD = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false, last_inbound_at: new Date().toISOString(), primary_channel: 'wa_web' }]
  const renderWith = async (due: boolean | null | undefined) => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: THREAD } })
      return Promise.resolve({ data: { data: [] } })
    })
    const user = userEvent.setup()
    const extra = due === undefined ? {} : { privacyNotice: { sentAt: null, due } }
    render(<CommunicationTab c={candidate({}, extra as Partial<Candidate>)} />)
    await user.click(screen.getByRole('tab', { name: 'sections.conversations' }))
    await screen.findByPlaceholderText('conversations.composerPlaceholder')
  }

  it('shows the hint when due is true', async () => {
    await renderWith(true)
    expect(screen.getByText('conversations.privacyNoticeIncluded')).toBeInTheDocument()
  })

  it.each([false, null, undefined])('omits the hint when due is %s', async due => {
    await renderWith(due)
    expect(screen.queryByText('conversations.privacyNoticeIncluded')).toBeNull()
  })
})

// GAPS-A4: a deep-link action survives the permission load; it is consumed only once loading is done and the permission is missing.
describe('CommunicationTab · start action vs auth loading (GAPS-A4)', () => {
  it('does not consume the action while auth.loading, then consumes it once loaded without permission', () => {
    mockUseAuth.mockReturnValue({ loading: true, hasPermission: () => false })
    const onConsumed = vi.fn()
    const el = () => <CommunicationTab c={candidate({}, { mobile: '+31612345678' })} initialSubTab="conversations" initialAction="start" onInitialActionConsumed={onConsumed} />
    const { rerender } = render(el())
    expect(onConsumed).not.toHaveBeenCalled()
    mockUseAuth.mockReturnValue({ loading: false, hasPermission: () => false })
    rerender(el())
    expect(onConsumed).toHaveBeenCalled()
  })
})
