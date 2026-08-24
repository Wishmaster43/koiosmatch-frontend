/**
 * useNotifications — regression test for the poll tick-guard: an idle background tab
 * must not keep hitting GET /notifications. The extracted pure predicate is covered
 * directly.
 *
 * NOTIF-ATTENTION-V1: a row that is NEW since the previous poll (unseen, absent from
 * the prior known-id set) fires one attention toast via `km:toast`, capped at 3
 * individual toasts per tick plus a summary toast for the rest, with one chime per
 * tick that produced attention toasts — gated by the `notif_sound_enabled` setting.
 * The very FIRST load never toasts (it would replay the whole feed as "new").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { shouldPollNotifications, useNotifications } from './useNotifications'
import api from '@/lib/api'
import { playNotificationChime } from '@/lib/notificationSound'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
// Sound gate: mocked so tests never touch real Web Audio (API-CREDITS-1 — no real
// side effects — and Web Audio has no meaning under jsdom anyway).
vi.mock('@/lib/notificationSound', () => ({ playNotificationChime: vi.fn() }))
// The chime gate is a PER-USER preference (ui_preferences via useUserPreference),
// never the tenant settings blob. Default ON; a test flips it via soundPref.
const soundPref = { value: true }
vi.mock('@/hooks/useUserPreference', () => ({
  useUserPreference: (_key: string, fallback: boolean) => [soundPref.value ?? fallback, vi.fn()],
}))

describe('shouldPollNotifications', () => {
  it('allows a tick while the tab is visible', () => {
    expect(shouldPollNotifications('visible')).toBe(true)
  })

  it('skips a tick while the tab is hidden', () => {
    expect(shouldPollNotifications('hidden')).toBe(false)
  })
})

describe('useNotifications attention toasts', () => {
  // A fresh created_at: only rows created around the last poll window count as
  // NEW (age guard) — an old unseen row that shifts into the feed never toasts.
  const row = (id: number, seen: boolean, createdAt: string = new Date().toISOString()) =>
    ({ id, title: `Row ${id}`, body: 'body', seen, entity_type: 'task', entity_id: id, created_at: createdAt })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    soundPref.value = true
  })
  afterEach(() => { vi.useRealTimers() })

  it('fires one km:toast for a row that is new on the second poll, and does not toast on the first load', async () => {
    const onToast = vi.fn()
    window.addEventListener('km:toast', onToast)
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [row(1, false)] } })
      .mockResolvedValueOnce({ data: { data: [row(1, false), row(2, false)] } })

    const { result } = renderHook(() => useNotifications(1000))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(onToast).not.toHaveBeenCalled() // first load never toasts

    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    expect(onToast).toHaveBeenCalledTimes(1)
    const detail = (onToast.mock.calls[0][0] as CustomEvent).detail
    expect(detail.title).toBe('Row 2')
    expect(detail.deepLink).toContain('tasks?open=2')
    expect(typeof detail.onOpen).toBe('function')
    expect(playNotificationChime).toHaveBeenCalledTimes(1)
    window.removeEventListener('km:toast', onToast)
  })

  it('caps individual toasts at 3 and adds one summary toast for the rest', async () => {
    const onToast = vi.fn()
    window.addEventListener('km:toast', onToast)
    const fresh = [1, 2, 3, 4, 5].map(id => row(id, false))
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: fresh } })

    const { result } = renderHook(() => useNotifications(1000))
    await waitFor(() => expect(result.current.items).toHaveLength(0))
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.items).toHaveLength(5))

    // 3 individual + 1 summary = 4 toasts.
    expect(onToast).toHaveBeenCalledTimes(4)
    expect(playNotificationChime).toHaveBeenCalledTimes(1)
    window.removeEventListener('km:toast', onToast)
  })

  it('does not play the chime when the user preference is off', async () => {
    soundPref.value = false
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [row(9, false)] } })

    const { result } = renderHook(() => useNotifications(1000))
    await waitFor(() => expect(result.current.items).toHaveLength(0))
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    expect(playNotificationChime).not.toHaveBeenCalled()
  })

  it('never toasts an unseen row whose created_at is old (it merely shifted into the feed)', async () => {
    const onToast = vi.fn()
    window.addEventListener('km:toast', onToast)
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [row(7, false, old)] } })

    const { result } = renderHook(() => useNotifications(1000))
    await waitFor(() => expect(result.current.items).toHaveLength(0))
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    expect(onToast).not.toHaveBeenCalled()
    expect(playNotificationChime).not.toHaveBeenCalled()
    window.removeEventListener('km:toast', onToast)
  })

  it('never toasts an already-seen row', async () => {
    const onToast = vi.fn()
    window.addEventListener('km:toast', onToast)
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [row(3, true)] } })

    const { result } = renderHook(() => useNotifications(1000))
    await waitFor(() => expect(result.current.items).toHaveLength(0))
    await act(async () => { result.current.reload() })
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    expect(onToast).not.toHaveBeenCalled()
    window.removeEventListener('km:toast', onToast)
  })
})
