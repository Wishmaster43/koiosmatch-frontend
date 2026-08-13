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

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.location.hash = '' })

describe('resolveNotificationTarget', () => {
  it('resolves an entity_type/entity_id row to its page + id', () => {
    expect(resolveNotificationTarget({ id: 1, entity_type: 'task', entity_id: 42 } as any))
      .toEqual({ page: 'tasks', id: '42' })
  })

  it('resolves a nested meta.type/meta.id row', () => {
    expect(resolveNotificationTarget({ id: 2, meta: { type: 'candidate', id: 'abc' } } as any))
      .toEqual({ page: 'candidates', id: 'abc' })
  })

  it('resolves a same-app hash link', () => {
    expect(resolveNotificationTarget({ id: 3, link: '#vacancies?open=9' } as any))
      .toEqual({ page: 'vacancies', id: '9' })
  })

  it('returns null when nothing on the row is a real target', () => {
    expect(resolveNotificationTarget({ id: 4, title: 'System message' } as any)).toBeNull()
  })

  it('returns null for an unmapped entity type', () => {
    expect(resolveNotificationTarget({ id: 5, entity_type: 'unknown', entity_id: 1 } as any)).toBeNull()
  })
})

describe('NotificationBell row click-through', () => {
  it('navigates (hash + popstate) when a row has a resolvable target', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 1, title: 'Match verloopt', entity_type: 'match', entity_id: '55', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as any)
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
    } as any)
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
