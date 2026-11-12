/** CommunicationTab consent suites: heading sweep, optimistic consent date, tri-state. */
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

describe('CommunicationTab · sub-tab heading sweep (Danny addendum 4)', () => {
  it('Toestemmingen has no repeated in-content heading', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))
    expect(screen.getAllByText('communication.consentTitle')).toHaveLength(1) // the sub-tab button only
  })

  it('Notities (default sub-tab) has no repeated in-content heading', () => {
    render(<CommunicationTab c={candidate()} />)
    expect(screen.getAllByText('sections.notes')).toHaveLength(1) // the sub-tab button only
  })

  it('Tijdlijn has no repeated in-content heading', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'sections.timeline' }))
    expect(screen.getAllByText('sections.timeline')).toHaveLength(1)
  })

  it('Conversaties has no repeated in-content heading', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'sections.conversations' }))
    expect(screen.getAllByText('sections.conversations')).toHaveLength(1)
  })

  it('Taken sub-tab renders (its own heading is CandidateTasks.tsx\'s concern, stubbed here)', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'drawer.tasksTitle' }))
    expect(screen.getByTestId('candidate-tasks-stub')).toBeInTheDocument()
  })
})

describe('CommunicationTab · optimistic consent date (Danny punt F)', () => {
  const openConsent = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))

  it('toggling a channel ON stamps the local _consent_at immediately (never sent to the server — buildCandidatePatch strips it)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('switch')[0]) // whatsapp is first in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_opt_in: true, whatsapp_consent_at: expect.any(String) }))
  })

  it('toggling a channel OFF nulls the local _consent_at so no stale date lingers next to an unchecked box', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: true, whatsapp_consent_at: '2026-01-01T00:00:00.000Z' })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('switch')[0])
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_opt_in: false, whatsapp_consent_at: null }))
  })

  it('the email channel gets the same optimistic-date treatment as whatsapp', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ email_opt_in: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('switch')[1]) // email is second in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ email_opt_in: true, email_consent_at: expect.any(String) }))
  })

  it('the newsletter channel gets the identical optimistic-date treatment as whatsapp/email', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ newsletter_opt_in: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('switch')[2]) // newsletter is third in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newsletter_opt_in: true, newsletter_consent_at: expect.any(String) }))
  })

  it('renders the server state caption per channel (K-008), granted with its date', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ newsletter_opt_in: true, newsletter_consent_at: '2026-01-01T00:00:00.000Z', newsletterConsentState: 'granted', whatsappConsentState: 'refused', emailConsentState: 'not_asked' })} />)
    await openConsent(user)
    // Raw-key i18n in this test file (no real i18next instance): assert the keys.
    expect(screen.getByText(/consentState\.grantedAt/)).toBeTruthy()
    expect(screen.getByText(/consentState\.refused/)).toBeTruthy()
    expect(screen.getByText(/consentState\.notAsked/)).toBeTruthy()
  })

  it('shows no state caption when the server sent no state', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: true })} />)
    await openConsent(user)
    expect(screen.queryByText(/consentState\./)).toBeNull()
  })
})

// CONSENT-TRISTATE-FE-1 (K-008): a toggle is ON only for an explicit grant (null = not
// asked renders OFF), and a flip hands the host ONLY its own channel + stamp — an
// untouched channel is never re-sent, so a null can never turn into false or true.
describe('CommunicationTab · consent tri-state (CONSENT-TRISTATE-FE-1)', () => {
  it('renders a not-asked channel OFF and sends only the flipped channel', async () => {
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: null, email_opt_in: true, newsletter_opt_in: null })} onSave={onSave} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))
    const wa = screen.getByRole('switch', { name: 'communication.consentWhatsapp' })
    expect(wa).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'communication.consentEmail' })).toHaveAttribute('aria-checked', 'true')
    await user.click(wa)
    expect(onSave).toHaveBeenCalledTimes(1)
    const sent = onSave.mock.calls[0][0] as Record<string, unknown>
    expect(sent.whatsapp_opt_in).toBe(true)
    expect(typeof sent.whatsapp_consent_at).toBe('string')
    expect(sent).not.toHaveProperty('email_opt_in')
    expect(sent).not.toHaveProperty('newsletter_opt_in')
  })
})

// K-008 verifier fixes: the toggle reads the server state; a flip updates the state optimistically.
describe('CommunicationTab · consent state drives toggle and caption (K-008)', () => {
  it('renders an unconfirmed legacy row (raw true, no stamp) as an OFF toggle with the unconfirmed caption', async () => {
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: true, whatsappConsentState: 'unconfirmed' })} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))
    expect(screen.getByRole('switch', { name: 'communication.consentWhatsapp' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/consentState\.unconfirmed/)).toBeTruthy()
  })

  it('a click on a not-asked channel sends the flag and the optimistic granted state', async () => {
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: null, whatsappConsentState: 'not_asked' })} onSave={onSave} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'communication.consentTitle' }))
    await user.click(screen.getByRole('switch', { name: 'communication.consentWhatsapp' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_opt_in: true, whatsappConsentState: 'granted' }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('emailConsentState')
  })
})
