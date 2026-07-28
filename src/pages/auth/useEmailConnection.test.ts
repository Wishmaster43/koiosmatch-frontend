/**
 * useEmailConnection — regression coverage for the three silent-failure bugs found
 * in the 2026-07-28 audit (§3 — a failed mutation must never go unreported, and
 * never LIE that it succeeded):
 *   - disconnect() used to mark 'disconnected' unconditionally, even when the POST
 *     failed — the UI showed the mailbox unlinked while the backend kept it wired.
 *   - connectOauth()/saveSmtp() swallowed every non-404 failure with zero feedback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEmailConnection } from './useEmailConnection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('useEmailConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disconnect: only flips to disconnected once the server confirms', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'connected', provider: 'gmail', email: 'a@b.nl' } })
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(() => useEmailConnection())
    await waitFor(() => expect(result.current.status).toBe('connected'))

    await act(async () => { await result.current.disconnect() })

    expect(result.current.status).toBe('disconnected')
  })

  it('disconnect: a failed POST keeps the connected state and notifies — never lies about success', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'connected', provider: 'gmail', email: 'a@b.nl' } })
    vi.mocked(api.post).mockRejectedValueOnce(new Error('500'))
    const { result } = renderHook(() => useEmailConnection())
    await waitFor(() => expect(result.current.status).toBe('connected'))

    await act(async () => { await result.current.disconnect() })

    expect(result.current.status).toBe('connected')
    expect(notifyError).toHaveBeenCalledWith('profile.email.disconnectFailed')
  })

  it('connectOauth: a non-404 failure notifies instead of failing silently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'disconnected' } })
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } })
    const { result } = renderHook(() => useEmailConnection())
    await waitFor(() => expect(result.current.status).toBe('disconnected'))

    await act(async () => { await result.current.connectOauth('gmail') })

    expect(notifyError).toHaveBeenCalledWith('profile.email.connectFailed')
    expect(result.current.busy).toBe(false)
  })

  it('saveSmtp: a non-404 failure notifies instead of failing silently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'disconnected' } })
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 422 } })
    const { result } = renderHook(() => useEmailConnection())
    await waitFor(() => expect(result.current.status).toBe('disconnected'))

    await act(async () => {
      await result.current.saveSmtp({ host: 'smtp.x.nl', port: '587', user: 'u', pass: 'p', secure: 'tls', from_name: '', from_email: '' })
    })

    expect(notifyError).toHaveBeenCalledWith('profile.email.connectFailed')
    expect(result.current.status).toBe('disconnected')
  })
})
