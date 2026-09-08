/**
 * NotificationBell — BEL-DOORKLIK regression: a row with a resolvable target
 * navigates (pushes the shell's hash-history + fires popstate); a row with no
 * target stays inert (no fake affordance, §3).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { resolveNotificationTarget } from './NotificationBell'
import NotificationBell from './NotificationBell'
import * as useNotificationsModule from '@/hooks/useNotifications'
import type { AppNotification } from '@/hooks/useNotifications'

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.location.hash = '' })

describe('resolveNotificationTarget', () => {
  it('resolves an entity_type/entity_id row to its page + id', () => {
    expect(resolveNotificationTarget({ id: 1, entity_type: 'task', entity_id: 42 } as unknown as AppNotification))
      .toEqual({ page: 'tasks', id: '42' })
  })

  it('resolves a nested meta.type/meta.id row', () => {
    expect(resolveNotificationTarget({ id: 2, meta: { type: 'candidate', id: 'abc' } } as unknown as AppNotification))
      .toEqual({ page: 'candidates', id: 'abc' })
  })

  it('resolves a same-app hash link', () => {
    expect(resolveNotificationTarget({ id: 3, link: '#vacancies?open=9' } as unknown as AppNotification))
      .toEqual({ page: 'vacancies', id: '9' })
  })

  it('returns null when nothing on the row is a real target', () => {
    expect(resolveNotificationTarget({ id: 4, title: 'System message' } as unknown as AppNotification)).toBeNull()
  })

  it('returns null for an unmapped entity type', () => {
    expect(resolveNotificationTarget({ id: 5, entity_type: 'unknown', entity_id: 1 } as unknown as AppNotification)).toBeNull()
  })

  // NOTIF-CONTEXTEN-FE-1: calllist/opportunity notifications carry a custom
  // meta shape (campaign_id / opportunity_id), resolved via their own `type`.
  it('resolves a calllist.target_assigned row to the campaign on the call-lists page', () => {
    expect(resolveNotificationTarget({ id: 6, type: 'calllist.target_assigned', meta: { campaign_id: 'c1', count: 3 } } as unknown as AppNotification))
      .toEqual({ page: 'outreach', id: 'c1' })
  })

  it('resolves an opportunity.won row to the opportunity drawer', () => {
    expect(resolveNotificationTarget({ id: 7, type: 'opportunity.won', meta: { opportunity_id: 'o1' } } as unknown as AppNotification))
      .toEqual({ page: 'opportunities', id: 'o1' })
  })

  it('resolves an opportunity.lost row to the opportunity drawer', () => {
    expect(resolveNotificationTarget({ id: 8, type: 'opportunity.lost', meta: { opportunity_id: 'o2' } } as unknown as AppNotification))
      .toEqual({ page: 'opportunities', id: 'o2' })
  })

  // SETTINGS-TABS-FIX-1 review: a custom-typed row whose meta is missing the
  // field its resolver needs must degrade honestly (null, no link) rather than
  // fall through to a half-built target.
  it('returns null for a custom-typed row with meta missing the expected field (unknown meta degrades honestly)', () => {
    expect(resolveNotificationTarget({ id: 9, type: 'opportunity.won', meta: {} } as unknown as AppNotification)).toBeNull()
  })

  // NOTIF-PAYLOAD (CMBE 8f0fcdb8): the backend now resolves the click-through url
  // server-side — prefer it over the local fallbacks below.
  it('prefers the server-resolved url over the local entity_type fallback', () => {
    expect(resolveNotificationTarget({
      id: 10, entity_type: 'candidate', entity_id: '99', url: '/#candidates?open=99',
    } as unknown as AppNotification)).toEqual({ page: 'candidates', id: '99' })
  })

  it('stays non-clickable when the server could not resolve a target (url "/", entity_type null)', () => {
    expect(resolveNotificationTarget({ id: 11, entity_type: null, url: '/' } as unknown as AppNotification)).toBeNull()
  })

  // BEL-ACTIE-VANDAAG-1: appointment.today has no agenda page yet, so it
  // deep-links to the candidate drawer via meta.candidate_id.
  it('resolves an appointment.today row to the candidate drawer', () => {
    expect(resolveNotificationTarget({
      id: 12, type: 'appointment.today', meta: { appointment_id: 'a1', candidate_id: 'c9', at: '2026-08-23T10:00:00Z' },
    } as unknown as AppNotification)).toEqual({ page: 'candidates', id: 'c9' })
  })

  it('returns null for an appointment.today row with meta missing candidate_id (no crash, no link)', () => {
    expect(resolveNotificationTarget({ id: 13, type: 'appointment.today', meta: { appointment_id: 'a1' } } as unknown as AppNotification)).toBeNull()
  })

  // Hardening: CUSTOM_TYPE_TARGETS must never resolve a `type` through
  // Object.prototype — 'constructor'/'toString' are not real notification types
  // and must behave exactly like any other unmapped type (null, never a crash or
  // a fabricated {page: undefined, id: undefined} target).
  it('treats a "constructor"/"toString" type as unmapped, not as an inherited Object.prototype member', () => {
    expect(resolveNotificationTarget({ id: 10, type: 'constructor', meta: {} } as unknown as AppNotification)).toBeNull()
    expect(resolveNotificationTarget({ id: 11, type: 'toString', meta: {} } as unknown as AppNotification)).toBeNull()
  })
})

describe('NotificationBell · focus trap (§6 WCAG 2.2 AA)', () => {
  it('renders the panel with proper dialog semantics', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Test notification', entity_type: 'task', entity_id: '1', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const panel = screen.getByRole('dialog', { name: /notificat/i })
    expect(panel).not.toHaveAttribute('aria-modal')
    expect(panel).toHaveAttribute('tabindex', '-1')
  })

  it('closes on Escape via the focus trap', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Test', entity_type: 'task', entity_id: '1', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    const trigger = screen.getByRole('button', { name: /notificat/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to the trigger button on close', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Test', entity_type: 'task', entity_id: '1', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    const trigger = screen.getByRole('button', { name: /notificat/i })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    // After closing via Escape, focus should return to the trigger button
    expect(document.activeElement).toBe(trigger)
  })
})

describe('NotificationBell row click-through', () => {
  it('navigates (hash + popstate) when a row has a resolvable target', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Match verloopt', entity_type: 'match', entity_id: '55', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    const onPopState = vi.fn()
    window.addEventListener('popstate', onPopState)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    fireEvent.click(screen.getByText('Match verloopt'))
    expect(window.location.hash).toBe('#matches?open=55')
    expect(onPopState).toHaveBeenCalledTimes(1)
    window.removeEventListener('popstate', onPopState)
  })

  // NOTIF-ATTENTION-V1: a resolvable row also carries a trailing new-tab icon
  // anchor (EntityLink idiom), independent of the in-app name click.
  it('renders a new-tab anchor for a resolvable row, pointing at its deep link', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Match verloopt', entity_type: 'match', entity_id: '55', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('matches?open=55'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('does not navigate when a row has no resolvable target', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 2, title: 'System message', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    const onPopState = vi.fn()
    window.addEventListener('popstate', onPopState)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // A row without a target is plain content: no button role, default cursor.
    const row = screen.getByText('System message').closest('[tabindex="-1"]') as HTMLElement
    expect(row).not.toHaveAttribute('role')
    expect(row).toHaveStyle({ cursor: 'default' })
    fireEvent.click(row)
    expect(window.location.hash).toBe('')
    expect(onPopState).not.toHaveBeenCalled()
    window.removeEventListener('popstate', onPopState)
  })

  // NOTIF-PAYLOAD / K-192: a workflow-run row renders its action-status line, keyed
  // off the next_action KEY (not prose); a plain row does not.
  it('renders the action-status line for a workflow-run row', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 1, title: 'Workflow run', seen: false,
        action_status: 'failed', next_action: 'check_followup_task',
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    expect(screen.getByText(/Bekijk de aangemaakte vervolgtaak\./)).toBeInTheDocument()
  })

  // K-192: an unknown next_action key must never render the raw key.
  it('renders no follow-up line for an unknown next_action key', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{
        id: 3, title: 'Workflow run', seen: false,
        action_status: 'failed', next_action: 'some_unknown_key',
      }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    expect(screen.queryByText(/some_unknown_key/)).not.toBeInTheDocument()
  })

  it('renders no action-status line for a plain row', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 2, title: 'Plain row', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    expect(screen.queryByText(/Bekijk de aangemaakte/)).not.toBeInTheDocument()
  })
})

describe('NotificationBell · X-31 "ask Koios" action', () => {
  // X-31: render the "Vraag Koios" button only when koios_action carries a non-empty prompt.
  it('renders the "ask Koios" button when a row carries a Koios prompt', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 1, title: 'Match question', seen: false,
          koios_action: { prompt: 'Stel een vraag over deze match' },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // The button contains KoiosAiMark (with aria-label "Koios AI") + translated text.
    // Search for a button that has a KoiosAiMark ancestor (contains img with aria-label).
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')
    expect(askKoiosButton).toBeInTheDocument()
  })

  it('calls askKoios with the prompt when the button is clicked', async () => {
    const promptText = 'Waarom is deze match niet geschikt?'
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent')
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 2, title: 'Advice question', seen: false,
          koios_action: { prompt: promptText },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'km:ask-koios',
        detail: { text: promptText, ref: undefined },
      }),
    )
  })

  it('closes the bell panel when the "ask Koios" button is clicked', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 3, title: 'Question', seen: false,
          koios_action: { prompt: 'Test prompt' },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    const trigger = screen.getByRole('button', { name: /notificat/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render the button when koios_action is null', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 4, title: 'No prompt', seen: false, koios_action: null }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // No KoiosAiMark should be rendered in the notification row.
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    // Only the dialog/topbar should have a KoiosAiMark, not the notification rows.
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when koios_action is missing', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 5, title: 'Plain notification', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when the prompt is empty string', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 6, title: 'Empty prompt', seen: false, koios_action: { prompt: '' } }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when the prompt is only whitespace', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 7, title: 'Whitespace prompt', seen: false, koios_action: { prompt: '   ' } }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  // X-31: the button click does NOT mark the notification as read by itself.
  it('does not mark the notification as read when the button is clicked', () => {
    const markAllSeenMock = vi.fn()
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 8, title: 'Question', seen: false,
          koios_action: { prompt: 'Test' },
        },
      ],
      unseen: 1, markAllSeen: markAllSeenMock, reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // markAllSeen should have been called once (when opening the panel).
    expect(markAllSeenMock).toHaveBeenCalledTimes(1)
    // Clicking the button should not call markAllSeen again.
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(markAllSeenMock).toHaveBeenCalledTimes(1)
  })
})
