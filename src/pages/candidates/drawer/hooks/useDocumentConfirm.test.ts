/**
 * useDocumentConfirm — F-004 request-seam coverage: the accept POST route, the
 * row replacement, the error path, and the two guards.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDocumentConfirm } from './useDocumentConfirm'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'
import { formatDocSize } from '../documentHelpers'
import type { DocItem } from '../documentHelpers'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const mockedPost = vi.mocked(api.post)
afterEach(() => vi.clearAllMocks())

const candidate = { id: 'c1' } as unknown as Candidate
const rows: DocItem[] = [{ id: 'd1', name: 'a.pdf', confirmed_at: null }, { id: 'd2', name: 'b.pdf', confirmed_at: null }]

// Applies the hook's functional state update to a local copy of the rows.
function setup() {
  let docs = rows
  const setDocs = vi.fn((u: unknown) => { docs = typeof u === 'function' ? (u as (p: DocItem[]) => DocItem[])(docs) : (u as DocItem[]) })
  const hook = renderHook(() => useDocumentConfirm(candidate, setDocs))
  return { hook, setDocs, getDocs: () => docs }
}

describe('useDocumentConfirm', () => {
  it('POSTs the confirm route once and replaces only that row', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'd1', confirmed_at: '2026-11-12T10:00:00Z', size: 44856 } } })
    const { hook, getDocs } = setup()
    await act(async () => { await hook.result.current.confirmDoc('d1') })
    expect(mockedPost).toHaveBeenCalledTimes(1)
    expect(mockedPost.mock.calls[0][0]).toBe('/candidates/c1/documents/d1/confirm')
    // The POST carries no body.
    expect(mockedPost.mock.calls[0]).toHaveLength(1)
    expect(getDocs()[0].size).toBe(formatDocSize(44856))
    expect(getDocs()[0].size).not.toBe(44856)
    expect(getDocs()[0].confirmed_at).toBe('2026-11-12T10:00:00Z')
    expect(getDocs()[1].confirmed_at).toBeNull()
    expect(hook.result.current.confirmingId).toBeNull()
  })

  it('formats the size of an unwrapped confirm response too', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'd1', confirmed_at: '2026-11-12T10:00:00Z', size: 44856 } })
    const { hook, getDocs } = setup()
    await act(async () => { await hook.result.current.confirmDoc('d1') })
    expect(getDocs()[0].size).toBe(formatDocSize(44856))
  })

  it('leaves the row unchanged and notifies on a rejected POST', async () => {
    mockedPost.mockRejectedValue({ response: { data: { message: 'nope' } } })
    const { hook, getDocs } = setup()
    await act(async () => { await hook.result.current.confirmDoc('d1') })
    expect(getDocs()[0].confirmed_at).toBeNull()
    expect(notifyError).toHaveBeenCalledWith('nope')
  })

  it('sends nothing for an unpersisted id', async () => {
    const { hook } = setup()
    await act(async () => { await hook.result.current.confirmDoc(-1) })
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('sends nothing for a second call while one is in flight', async () => {
    let resolve: (v: unknown) => void = () => {}
    mockedPost.mockReturnValue(new Promise(r => { resolve = r }) as never)
    const { hook } = setup()
    let first: Promise<void> = Promise.resolve()
    act(() => { first = hook.result.current.confirmDoc('d1') })
    await act(async () => { await hook.result.current.confirmDoc('d2') })
    expect(mockedPost).toHaveBeenCalledTimes(1)
    await act(async () => { resolve({ data: { data: { id: 'd1' } } }); await first })
  })
})
