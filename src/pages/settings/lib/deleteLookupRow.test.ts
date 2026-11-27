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

  it('flags the row in_use instead of removing it on an uncoded 409 (the MarksLookupUsage in-use conflict)', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409, data: { message: 'This item is still in use and cannot be deleted.' } } })
    let items: Row[] = [{ id: '1', in_use: false }]
    const setItems: Dispatch<SetStateAction<Row[]>> = vi.fn((next) => {
      items = typeof next === 'function' ? (next as (p: Row[]) => Row[])(items) : next
    })
    const onError = vi.fn()
    await deleteLookupRow('/provinces', { id: '1' }, setItems, vi.fn(), onError)
    expect(items).toEqual([{ id: '1', in_use: true }])
    expect(onError).not.toHaveBeenCalled()
  })

  // TASK-STATUS-LAST-ROW-FE-1: a coded 409 is a refusal with its own translated sentence, never an in-use flag.
  it('keeps the row unflagged and hands a coded 409 (task_status_last_row) to onError', async () => {
    const err = { response: { status: 409, data: { code: 'task_status_last_row', message: 'server sentence' } } }
    vi.mocked(api.delete).mockRejectedValue(err)
    let items: Row[] = [{ id: 's1', in_use: false }]
    const setItems: Dispatch<SetStateAction<Row[]>> = vi.fn((next) => {
      items = typeof next === 'function' ? (next as (p: Row[]) => Row[])(items) : next
    })
    const onError = vi.fn()
    await deleteLookupRow<Row>('/task-statuses', { id: 's1', in_use: false }, setItems, vi.fn(), onError)
    expect(api.delete).toHaveBeenCalledWith('/task-statuses/s1')
    expect(items).toEqual([{ id: 's1', in_use: false }])
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('calls onError for any other failure', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 500 } })
    const setItems = vi.fn() as unknown as Dispatch<SetStateAction<Row[]>>
    const onError = vi.fn()
    await deleteLookupRow('/provinces', { id: '1' }, setItems, vi.fn(), onError)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith({ response: { status: 500 } })
  })
})
