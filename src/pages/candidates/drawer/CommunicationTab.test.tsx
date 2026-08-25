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
import { invalidateRetentionConsentMonths } from './useRetentionConsentMonths'
import type { Candidate } from '@/types/candidate'

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

const candidate = (consent: Record<string, unknown> = {}, extra: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, consent, timeline: [], name: 'Piet', initials: 'PJ', ownerInitials: 'AB', ...extra } as unknown as Candidate)

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

// WHATSAPP-COMPOSE-1 (Danny 06-08): the "Conversatie starten" trigger next to the
// Conversaties section — disabled with an honest title for a candidate without a
// mobile number (no dead sends, §3), enabled + opens the modal otherwise.
describe('CommunicationTab · WhatsApp start trigger (WHATSAPP-COMPOSE-1)', () => {
  const goToConversations = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('tab', { name: 'sections.conversations' }))

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

  it('opens the start-conversation modal on click', async () => {
    const user = userEvent.setup()
    render(<CommunicationTab c={candidate({}, { mobile: '+31612345678' })} />)
    await goToConversations(user)
    await user.click(screen.getByRole('button', { name: 'conversations.start' }))
    expect(screen.getByRole('dialog', { name: 'conversations.startModalTitle' })).toBeInTheDocument()
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
