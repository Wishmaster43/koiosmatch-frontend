/**
 * useMatchesDeepLink — §9 stale-response guard on the deep-link direct-fetch
 * fallback: a second, newer open (pendingOpenId A → B) must not let a slower
 * A response win and overwrite the newer B open with the wrong match.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMatchesDeepLink } from './useMatchesDeepLink'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrap: (r: { data: unknown }) => r.data }))
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

const t = ((k: string) => k) as unknown as import('i18next').TFunction

function setup(intent: unknown, rows: MatchRow[] = []) {
  const setSelected = vi.fn()
  const { rerender } = renderHook(
    ({ intent, rows }) => useMatchesDeepLink({ intent, rows, loading: false, selected: null, setSelected, t }),
    { initialProps: { intent, rows } },
  )
  return { setSelected, rerender }
}

describe('useMatchesDeepLink · deep-link fallback fetch', () => {
  it('sends the fallback GET for a target not in the loaded rows', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    mockedGet.mockReturnValue(new Promise(res => { resolveGet = res }))
    setup({ open: 'm-99' })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m-99', expect.objectContaining({ params: { include_archived: 1 } })))
    resolveGet({ data: { id: 'm-99' } })
  })

  it('never applies a stale response once the requested target has moved on (A→B)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    mockedGet.mockImplementationOnce(() => new Promise(res => { resolveA = res }))
    const { setSelected, rerender } = setup({ open: 'm-A' })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m-A', expect.anything()))

    // A newer open supersedes A before its response lands — B has its own row,
    // so no second fetch is needed; the hook selects it directly.
    rerender({ intent: { open: 'm-B' }, rows: [{ id: 'm-B' } as MatchRow] })
    await waitFor(() => expect(setSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-B' })))
    setSelected.mockClear()

    // The slow A response now resolves — the stale-response guard must drop it.
    resolveA({ data: { id: 'm-A' } })
    await new Promise(r => setTimeout(r, 0))
    expect(setSelected).not.toHaveBeenCalled()
  })

  it('re-issues the fallback GET after an effect re-run (StrictMode/rows-identity) for the same still-pending target', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    mockedGet.mockImplementationOnce(() => new Promise(res => { resolveFirst = res }))
    const { setSelected, rerender } = setup({ open: 'm-99' }, [])
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))

    // Cleanup runs (aborting the in-flight request) before the re-setup — the
    // dedupe ref must not stay stuck on 'm-99' and block the next fetch.
    let resolveSecond: (v: unknown) => void = () => {}
    mockedGet.mockImplementationOnce(() => new Promise(res => { resolveSecond = res }))
    rerender({ intent: { open: 'm-99' }, rows: [] as MatchRow[] })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))

    resolveFirst({ data: { id: 'm-99', stale: true } })
    resolveSecond({ data: { id: 'm-99' } })
    await waitFor(() => expect(setSelected).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-99' })))
  })
})
