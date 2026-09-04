/**
 * useApiKeys — K-282: add()/patch() must refetch the whole list, not only patch
 * the one row locally. Promoting a key to primary auto-demotes the previous
 * primary server-side, so a sibling row can change without any local mutation
 * telling this hook about it — only a real reload catches that drift.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useApiKeys } from './useApiKeys'
import { listApiKeys } from './apiKeysApi'

vi.mock('./apiKeysApi', () => ({ listApiKeys: vi.fn() }))

afterEach(() => vi.clearAllMocks())

const row = (over = {}) => ({ id: 'k1', friendly_name: 'Backoffice key', type: 'additional', ...over })

describe('useApiKeys — K-282 reload-on-mutation', () => {
  it('add() refetches the list after the optimistic insert', async () => {
    listApiKeys.mockResolvedValue({ rows: [row()] })
    const { result } = renderHook(() => useApiKeys())
    await waitFor(() => expect(listApiKeys).toHaveBeenCalledTimes(1))

    act(() => result.current.add(row({ id: 'k2' })))

    await waitFor(() => expect(listApiKeys).toHaveBeenCalledTimes(2))
  })

  it('patch() refetches the list after the optimistic update (K-282 auto-demote)', async () => {
    listApiKeys.mockResolvedValue({ rows: [row()] })
    const { result } = renderHook(() => useApiKeys())
    await waitFor(() => expect(listApiKeys).toHaveBeenCalledTimes(1))

    act(() => result.current.patch('k1', { type: 'primary' }))

    await waitFor(() => expect(listApiKeys).toHaveBeenCalledTimes(2))
  })

  it('drop() does not refetch — a delete never changes a sibling row', async () => {
    listApiKeys.mockResolvedValue({ rows: [row()] })
    const { result } = renderHook(() => useApiKeys())
    await waitFor(() => expect(listApiKeys).toHaveBeenCalledTimes(1))

    act(() => result.current.drop('k1'))

    expect(listApiKeys).toHaveBeenCalledTimes(1)
  })
})
