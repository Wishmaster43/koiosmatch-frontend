import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Dispatch, SetStateAction } from 'react'
import api from '@/lib/api'
import { deleteLookupRow } from './deleteLookupRow'

vi.mock('@/lib/api', () => ({ default: { delete: vi.fn() } }))

interface Row { id: string; in_use?: boolean }

// deleteLookupRow is the shared confirm→delete→409-conflict flow (ProvincesSettings, StatusListEditor).
describe('deleteLookupRow', () => {
  afterEach(() => vi.clearAllMocks())

  it('removes the row from the list on a successful delete', async () => {
    vi.mocked(api.delete).mockResolvedValue({})
    let items: Row[] = [{ id: '1' }, { id: '2' }]
    const setItems: Dispatch<SetStateAction<Row[]>> = vi.fn((next) => {
      items = typeof next === 'function' ? (next as (p: Row[]) => Row[])(items) : next
    })
    const setDeleting = vi.fn()
    await deleteLookupRow('/provinces', { id: '1' }, setItems, setDeleting, vi.fn())
    expect(api.delete).toHaveBeenCalledWith('/provinces/1')
    expect(items).toEqual([{ id: '2' }])
    expect(setDeleting).toHaveBeenNthCalledWith(1, '1')
    expect(setDeleting).toHaveBeenNthCalledWith(2, null)
  })

  it('flags the row in_use instead of removing it on a 409', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409 } })
    let items: Row[] = [{ id: '1', in_use: false }]
    const setItems: Dispatch<SetStateAction<Row[]>> = vi.fn((next) => {
      items = typeof next === 'function' ? (next as (p: Row[]) => Row[])(items) : next
    })
    const onError = vi.fn()
    await deleteLookupRow('/provinces', { id: '1' }, setItems, vi.fn(), onError)
    expect(items).toEqual([{ id: '1', in_use: true }])
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onError for any other failure', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 500 } })
    const setItems = vi.fn() as unknown as Dispatch<SetStateAction<Row[]>>
    const onError = vi.fn()
    await deleteLookupRow('/provinces', { id: '1' }, setItems, vi.fn(), onError)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
