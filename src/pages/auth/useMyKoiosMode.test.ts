/**
 * useMyKoiosMode — proves the REAL PUT request (route + body), per §13: a
 * mutation test must prove the seam, never only that a callback fired. Covers
 * the GET load, the optimistic mode/auto_messages PUT with rollback on failure,
 * and the Wizard-safe default while loading.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMyKoiosMode } from './useMyKoiosMode'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

afterEach(() => vi.clearAllMocks())

describe('useMyKoiosMode', () => {
  it('defaults to wizard/no-auto-messages until the GET resolves, then adopts the server value', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'auto', auto_messages: true } })
    const { result } = renderHook(() => useMyKoiosMode())

    expect(result.current.mode).toBe('wizard') // safe default before load resolves
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.mode).toBe('auto')
    expect(result.current.autoMessages).toBe(true)
  })

  it('PUTs the full { mode, auto_messages } body when switching to auto', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'wizard', auto_messages: false } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useMyKoiosMode())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setMode('auto') })

    expect(result.current.mode).toBe('auto') // optimistic
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-koios-mode', { mode: 'auto', auto_messages: false }))
  })

  it('PUTs auto_messages alongside the current mode', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'auto', auto_messages: false } })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useMyKoiosMode())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setAutoMessages(true) })

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/my-koios-mode', { mode: 'auto', auto_messages: true }))
  })

  it('rolls back the optimistic change and notifies on a failed PUT', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { mode: 'wizard', auto_messages: false } })
    vi.mocked(api.put).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useMyKoiosMode())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setMode('auto') })
    expect(result.current.mode).toBe('auto') // optimistic

    await waitFor(() => expect(result.current.mode).toBe('wizard')) // rolled back
    expect(notifyError).toHaveBeenCalled()
  })
})
