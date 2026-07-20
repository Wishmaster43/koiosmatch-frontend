/**
 * CommunicationTab — sub-tab heading sweep (Danny addendum 4, kandidaten-ronde-2)
 * and the optimistic consent-date fix (punt F). CandidateTasks pulls its own
 * heavy dependency tree (tasks API, action-rule preflight, the shared AddTaskModal)
 * that's out of scope here — stubbed to a marker so the Taken sub-tab is only
 * checked for presence, not its internals (those are CandidateTasks.test.tsx's job).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommunicationTab from './CommunicationTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))
vi.mock('@/lib/useNoteTypes', () => ({ useNoteTypes: () => ({ types: [], writableTypes: [] }), SYSTEM_NOTE_TYPES: new Set() }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ types: [] }) }))
// Mutable per-test notes list (vi.hoisted so the mock factory below can read it) —
// the status-change pencil tests need a system note in the list; every other test
// keeps the original empty list.
const { notesState } = vi.hoisted(() => ({ notesState: { notes: [] as unknown[] } }))
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => ({ notes: notesState.notes, addNote: vi.fn(), editNote: vi.fn() }),
}))
vi.mock('./CandidateTasks', () => ({ default: () => <div data-testid="candidate-tasks-stub" /> }))

const candidate = (consent: Record<string, unknown> = {}): Candidate =>
  ({ id: 1, consent, timeline: [], name: 'Piet', initials: 'PJ', ownerInitials: 'AB' } as unknown as Candidate)

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
    await user.click(screen.getAllByRole('checkbox')[0]) // whatsapp is first in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_opt_in: true, whatsapp_consent_at: expect.any(String) }))
  })

  it('toggling a channel OFF nulls the local _consent_at so no stale date lingers next to an unchecked box', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: true, whatsapp_consent_at: '2026-01-01T00:00:00.000Z' })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_opt_in: false, whatsapp_consent_at: null }))
  })

  it('the email channel gets the same optimistic-date treatment as whatsapp', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ email_opt_in: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('checkbox')[1]) // email is second in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ email_opt_in: true, email_consent_at: expect.any(String) }))
  })

  it('the newsletter channel gets the identical optimistic-date treatment as whatsapp/email', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<CommunicationTab c={candidate({ newsletter_opt_in: false })} onSave={onSave} />)
    await openConsent(user)
    await user.click(screen.getAllByRole('checkbox')[2]) // newsletter is third in CONSENT_CH
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newsletter_opt_in: true, newsletter_consent_at: expect.any(String) }))
  })

  it('renders a given-at line once a channel has both the flag and the date (any channel, incl. newsletter)', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ newsletter_opt_in: true, newsletter_consent_at: '2026-01-01T00:00:00.000Z' })} />)
    await openConsent(user)
    // Raw-key i18n in this test file (no real i18next instance) — assert the
    // translation call happened at all, not the interpolated Dutch copy.
    expect(screen.getAllByText(/consentGivenAt/).length).toBeGreaterThan(0)
  })

  it('shows no given-at line for a channel with no date yet', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({ whatsapp_opt_in: true })} />)
    await openConsent(user)
    expect(screen.queryByText(/consentGivenAt/)).toBeNull()
  })
})

// "Potlood op de statuswissel" (Danny 2026-07-20, job A): the Tijdlijn's
// "Statuswissel" system-note row gets an edit pencil, forwarded to the shared
// NotesTab's onEditStatusEvent — only when CandidateDrawer passes it down.
describe('CommunicationTab · status-change timeline pencil (Danny 2026-07-20)', () => {
  const goToTimeline = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'sections.timeline' }))

  beforeEach(() => {
    notesState.notes = [{ type: 'status_change', text: 'Ziek sinds 01-07', is_system: true, created_at: '2026-07-01T00:00:00.000Z' }]
  })
  afterEach(() => { notesState.notes = [] })

  it('shows the pencil on the Statuswissel row when onEditStatusEvent is passed', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} onEditStatusEvent={vi.fn()} />)
    await goToTimeline(user)
    expect(screen.getByTitle('drawer.editStatusReason')).toBeInTheDocument()
  })

  it('calls onEditStatusEvent when the pencil is clicked', async () => {
    const user = userEvent.setup()
    const onEditStatusEvent = vi.fn()
    render(<CommunicationTab c={candidate()} onEditStatusEvent={onEditStatusEvent} />)
    await goToTimeline(user)
    await user.click(screen.getByTitle('drawer.editStatusReason'))
    expect(onEditStatusEvent).toHaveBeenCalledTimes(1)
  })

  it('renders no pencil when onEditStatusEvent is not passed (additive prop, zero behaviour change)', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate()} />)
    await goToTimeline(user)
    expect(screen.queryByTitle('drawer.editStatusReason')).toBeNull()
  })

  it('never adds the pencil to a lifecycle system note — only "status_change" is editable in place', async () => {
    const user = userEvent.setup()
    notesState.notes = [{ type: 'lifecycle', text: 'Gearchiveerd', is_system: true, created_at: '2026-07-01T00:00:00.000Z' }]
    render(<CommunicationTab c={candidate()} onEditStatusEvent={vi.fn()} />)
    await goToTimeline(user)
    expect(screen.queryByTitle('drawer.editStatusReason')).toBeNull()
  })
})
