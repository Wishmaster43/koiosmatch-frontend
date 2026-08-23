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

  it('does not navigate when a row has no resolvable target', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 2, title: 'System message', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    const onPopState = vi.fn()
    window.addEventListener('popstate', onPopState)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const row = screen.getByText('System message').closest('[role="menuitem"]') as HTMLElement
    expect(row).toHaveStyle({ cursor: 'default' })
    fireEvent.click(row)
    expect(window.location.hash).toBe('')
    expect(onPopState).not.toHaveBeenCalled()
    window.removeEventListener('popstate', onPopState)
  })
})
