/**
 * useUsersData — regression coverage for the colour-pick mutation. Confirmed bug
 * (audit 2026-07-28): /users/{id} is documented PUT-only in the generated OpenAPI
 * contract (operations.putUsersUserId, `patch?: never`), yet setColor called
 * api.patch — every colour pick silently 405ed and reverted. Also locks in the
 * existing optimistic + revert-on-failure behaviour (§3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUsersData } from './useUsersData'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl', avatar_color: null }
// DATA: an arbitrary fixture colour value exercised through the mutation — not a UI style.
/* eslint-disable-next-line no-restricted-syntax */
const PICKED_COLOR = '#FF0000'

describe('useUsersData · setColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PUTs (not PATCHes) the colour change and keeps the optimistic value on success', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [testUser] } }).mockResolvedValueOnce({ data: [] })
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(() => useUsersData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.setColor(testUser, PICKED_COLOR) })

    expect(api.put).toHaveBeenCalledWith('/users/u1', { avatar_color: PICKED_COLOR })
    expect(api.patch).not.toHaveBeenCalled()
    expect(result.current.users[0].avatar_color).toBe(PICKED_COLOR)
  })

  it('reverts the colour on a failed save', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [testUser] } }).mockResolvedValueOnce({ data: [] })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useUsersData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.setColor(testUser, PICKED_COLOR) })

    // Back to the pre-pick colour — never a silently-wrong local state — and told about it.
    expect(result.current.users[0].avatar_color).toBe(null)
    expect(notifyError).toHaveBeenCalledWith('saveFailed')
  })
})
