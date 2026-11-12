/** CommunicationTab timeline suites: status pencil, match card, merged application events. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// Point 3 (MATCH-TIMELINE-EVENT-1): a tolerant pre-build — nothing renders
// differently until a timeline item actually carries the match.created payload;
// a plain item stays exactly as today (ev.text). Raw-key i18n in this file (no
// real i18next instance, same as every other describe block above): interpolation
// values still show up inline (built in JS, not via t()'s own substitution), only
// the surrounding phrase renders as its raw key.
describe('CommunicationTab · match.created timeline card (point 3, Danny live P1)', () => {
  const goToTimeline = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'sections.timeline' }))

  it('renders the readable match card for a match.created timeline item', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { timeline: [{
      type: 'match.created', created_at: '2026-07-01T00:00:00.000Z',
      customer_name: 'Zorggroep A', location_name: 'Locatie Noord',
      contract_type: 'Fase 1-2 z.u.b. (Works)', start_date: '2026-07-01', end_date: null,
      recruiter_name: 'Piet Recruiter',
    } as unknown as Candidate['timeline'][number]] })} />)
    await goToTimeline(user)
    // The title/meta PHRASES are raw i18n keys here, but the VALUES they wrap
    // (built in plain JS, not t()'s own interpolation) still show up inline.
    expect(screen.getByText(/communication\.timelinePlacedAt/)).toBeInTheDocument()
    expect(screen.getByText(/Locatie Noord/)).toBeInTheDocument()
    expect(screen.getByText(/Fase 1-2 z\.u\.b\. \(Works\)/)).toBeInTheDocument()
    expect(screen.getByText(/communication\.timelineOngoing/)).toBeInTheDocument() // no end_date → "ongoing"
    expect(screen.getByText(/communication\.timelineVia/)).toBeInTheDocument()
  })

  it('a plain timeline item (no match.created payload) renders exactly as before', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { timeline: [{ text: 'Bericht verstuurd', created_at: '2026-07-01T00:00:00.000Z' } as unknown as Candidate['timeline'][number]] })} />)
    await goToTimeline(user)
    expect(screen.getByText('Bericht verstuurd')).toBeInTheDocument()
    expect(screen.queryByText(/communication\.timelinePlacedAt/)).toBeNull()
  })

  it('skips missing parts cleanly — no dangling separator when contract_type/dates are absent', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { timeline: [{
      type: 'match.created', created_at: '2026-07-01T00:00:00.000Z', customer_name: 'Zorggroep A',
    } as unknown as Candidate['timeline'][number]] })} />)
    await goToTimeline(user)
    expect(screen.getByText(/communication\.timelinePlacedAt/)).toBeInTheDocument()
    // No location/contract/dates/via — the meta line never renders at all.
    expect(screen.queryByText(/communication\.timelineVia/)).toBeNull()
    expect(screen.queryByText(/communication\.timelineOngoing/)).toBeNull()
  })
})

// B24-TAB: application events (c.applications) are merged chronologically into the
// Tijdlijn alongside status/system events (c.timeline), via mergeTimelineEvents.
describe('CommunicationTab · merged timeline with application events (B24-TAB)', () => {
  const goToTimeline = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'sections.timeline' }))

  it('shows an application event interleaved with a status event, newest first', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, {
      timeline: [{ text: 'Status gewijzigd', created_at: '2026-08-01T09:00:00.000Z' } as unknown as Candidate['timeline'][number]],
      applications: [{ id: 'a1', vacancy_title: 'Verpleegkundige', created_at: '2026-08-05T09:00:00.000Z' }],
    })} />)
    await goToTimeline(user)
    expect(screen.getByText(/communication\.timelineApplication.*Verpleegkundige/)).toBeInTheDocument()
    const rows = screen.getAllByText(/Status gewijzigd|communication\.timelineApplication/)
    // Newest first: the application event (05-08) precedes the status event (01-08).
    expect(rows[0].textContent).toMatch(/communication\.timelineApplication/)
    expect(rows[1].textContent).toMatch(/Status gewijzigd/)
  })

  it('falls back to a generic label when the application carries no vacancy title', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, {
      applications: [{ id: 'a1', created_at: '2026-08-05T09:00:00.000Z' }],
    })} />)
    await goToTimeline(user)
    expect(screen.getByText('communication.timelineApplicationGeneric')).toBeInTheDocument()
  })

  // LOOKUP-I18N-1 regression: the application's funnel stage caption reads
  // `stageLabel`/`stageKey` — the real Candidate/ApplicationResource.php field
  // names — not the `funnel_stage_label`/`stage` keys the backend never sends;
  // that mismatch used to leave the caption blank on every real payload.
  it('shows the application funnel-stage caption from stageLabel/stageKey', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, {
      applications: [{ id: 'a1', vacancy_title: 'Verpleegkundige', stageLabel: 'Gesolliciteerd', stageKey: 'applied', created_at: '2026-08-05T09:00:00.000Z' }],
    })} />)
    await goToTimeline(user)
    expect(screen.getByText('Gesolliciteerd')).toBeInTheDocument()
  })
})
