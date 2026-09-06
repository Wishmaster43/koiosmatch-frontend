/**
 * useKoiosAdviceRun — S1 K-266/K-267 + repair-pass contract coverage: the
 * exact POST route, the 202/409/422/403/5xx branches, the run_id-targeted
 * poll, module-scope persistence across unmount (NOTE 3: a paid run must
 * survive a tab switch), and staleness clearing when the record's own runId
 * moves past what we cached. API-CREDITS-1: `@/lib/api` is fully mocked here
 * — this suite never makes a real network call, let alone a real AI call.
 * Each test uses its own record id so the module-scope store never leaks
 * state between tests (the store is never reset/exported).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import { useKoiosAdviceRun } from './useKoiosAdviceRun'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) {
      return (body as { data: unknown }).data
    }
    return body
  },
}))

// Resolve the active locale's own copy — assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers() })

describe('useKoiosAdviceRun', () => {
  it('POSTs the exact per-entity route', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { run_id: 'run-1' } })
    const { result } = renderHook(() => useKoiosAdviceRun('candidates', 'c1'))

    await act(async () => { await result.current.request() })

    expect(api.post).toHaveBeenCalledWith('/candidates/c1/koios-advice', undefined, expect.objectContaining({ quietStatuses: [403, 409, 422] }))
  })

  it('202 sets pending and polls until the run_id lands, then exposes freshAdvice', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockResolvedValue({ data: { run_id: 'run-1' } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'proceed', score: 80, run_id: 'run-1', generated_at: '2026-09-04T10:00:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('candidates', 'c2'))

    await act(async () => { await result.current.request() })
    expect(result.current.pending).toBe(true)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })

    expect(api.get).toHaveBeenCalledWith('/candidates/c2')
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ verdict: 'proceed', score: 80, runId: 'run-1' }))
    expect(result.current.pending).toBe(false)
  })

  it('409 (already running) shows the alreadyRunning notice and keeps polling for that run', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'busy', run_id: 'run-2' } } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'review', score: 40, run_id: 'run-2', generated_at: '2026-09-04T10:05:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('applications', 'c3'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe(ct('koios.advice.alreadyRunning'))
    expect(result.current.pending).toBe(true)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-2' }))
  })

  it('422 shows the server message via extractApiError and stops (never polls)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { message: 'Template is inactive.' } } })
    const { result } = renderHook(() => useKoiosAdviceRun('vacancies', 'c4'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe('Template is inactive.')
    expect(result.current.pending).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('422 without a server message falls back to the unavailable notice', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: {} } })
    const { result } = renderHook(() => useKoiosAdviceRun('customers', 'c5'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe(ct('koios.advice.unavailable'))
  })

  it('403 (module gate refused) shows the unavailable notice, not a raw server message', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403, data: { message: 'This action is unauthorized.' } } })
    const { result } = renderHook(() => useKoiosAdviceRun('matches', 'c6'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe(ct('koios.advice.unavailable'))
    expect(result.current.pending).toBe(false)
  })

  it('a 5xx/network failure falls back to the generic actionFailed notice', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 500, data: {} } })
    const { result } = renderHook(() => useKoiosAdviceRun('candidates', 'c7'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe(ct('actionFailed'))
    expect(result.current.pending).toBe(false)
  })

  it('a network failure with no response also falls back to actionFailed', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useKoiosAdviceRun('candidates', 'c7b'))

    await act(async () => { await result.current.request() })

    expect(result.current.notice).toBe(ct('actionFailed'))
  })

  it('a paid run survives unmount (module-scope persistence, NOTE 3): a later mount of the same record sees the landed result', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockResolvedValue({ data: { run_id: 'run-8' } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'renew', score: 90, run_id: 'run-8', generated_at: '2026-09-04T10:10:00Z' } } },
    })
    const { result, unmount } = renderHook(() => useKoiosAdviceRun('matches', 'c8'))
    await act(async () => { await result.current.request() })
    unmount()

    // The drawer tab is gone — the poll must keep running regardless.
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })

    // A later mount of the SAME record (tab switched back) sees the result
    // immediately, without starting a new (paid) run.
    const { result: result2 } = renderHook(() => useKoiosAdviceRun('matches', 'c8'))
    expect(result2.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-8' }))
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('clears a cached override once the record itself shows a THIRD, newer run (bulk/workflow refetch)', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockResolvedValue({ data: { run_id: 'run-a' } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'stable', score: 55, run_id: 'run-a', generated_at: '2026-09-04T10:15:00Z' } } },
    })
    const { result, rerender } = renderHook(
      ({ recordRunId }: { recordRunId?: string | null }) => useKoiosAdviceRun('customers', 'c9', recordRunId),
      { initialProps: { recordRunId: null as string | null } },
    )
    await act(async () => { await result.current.request() })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-a' }))

    // A bulk/workflow run elsewhere produced run-c — the record's own prop
    // now carries a run we never started and that isn't the baseline (null).
    rerender({ recordRunId: 'run-c' })
    expect(result.current.freshAdvice).toBeUndefined()
  })

  it('a second click while a run is already pending is a no-op — never a duplicate paid AI call', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockResolvedValue({ data: { run_id: 'run-old' } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'ok', score: null, run_id: 'run-old', generated_at: '2026-09-04T10:20:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('vacancies', 'c10'))
    await act(async () => { await result.current.request() })
    expect(result.current.pending).toBe(true)
    // A second click while the run is still in flight must not fire a second
    // real POST (API-CREDITS-1) — the module-scope pending flag is shared
    // across every component watching this record, not just this instance.
    await act(async () => { await result.current.request() })
    expect(api.post).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-old' }))
  })

  it('a fresh request() AFTER a run finished starts a genuinely new poll (gen bump), ignoring any leftover late tick', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { run_id: 'run-a' } })
      .mockResolvedValueOnce({ data: { run_id: 'run-b' } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'ok', score: null, run_id: 'run-b', generated_at: '2026-09-04T10:25:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('vacancies', 'c11'))
    // First run exhausts its poll budget without ever matching run-a (the GET
    // mock only ever returns run-b) — pending settles back to false.
    await act(async () => { await result.current.request() })
    for (let i = 0; i < 12; i++) { await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) }
    expect(result.current.pending).toBe(false)
    expect(result.current.freshAdvice).toBeUndefined()

    // A fresh click now starts run-b for real, and its own poll lands cleanly.
    await act(async () => { await result.current.request() })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-b' }))
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('409 -> the run lands -> the alreadyRunning notice is gone', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'busy', run_id: 'run-2' } } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'review', score: 40, run_id: 'run-2', generated_at: '2026-09-04T10:05:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('applications', 'c12'))

    await act(async () => { await result.current.request() })
    expect(result.current.notice).toBe(ct('koios.advice.alreadyRunning'))
    expect(result.current.pending).toBe(true)

    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.pending).toBe(false)
    expect(result.current.freshAdvice).toEqual(expect.objectContaining({ runId: 'run-2' }))
    // Pre-fix: pollForRun's landed-run publish() never cleared `notice`, and
    // publish() spreads the previous snapshot — so the 409 caption from
    // request() survives underneath the now-fresh advice card.
    expect(result.current.notice).toBeNull()
  })

  it("a finished attempt's notice never survives a remount", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 422, data: { message: 'Template is inactive.' } } })
    const { result, unmount } = renderHook(() => useKoiosAdviceRun('vacancies', 'c13'))

    await act(async () => { await result.current.request() })
    expect(result.current.notice).toBe('Template is inactive.')
    unmount()

    // Pre-fix: the module-scope store is never cleared, so the SAME 422
    // notice reappears on every later remount of this record's drawer.
    const { result: result2 } = renderHook(() => useKoiosAdviceRun('vacancies', 'c13'))
    expect(result2.current.notice).toBeNull()
    expect(result2.current.pending).toBe(false)
  })

  it('a run that outlives the poll budget ends without a stale notice', async () => {
    vi.useFakeTimers()
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { message: 'busy', run_id: 'run-9' } } })
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { koios_ai_advice: { verdict: 'review', score: 40, run_id: 'run-other', generated_at: '2026-09-04T10:06:00Z' } } },
    })
    const { result } = renderHook(() => useKoiosAdviceRun('applications', 'c14'))

    await act(async () => { await result.current.request() })
    expect(result.current.notice).toBe(ct('koios.advice.alreadyRunning'))

    for (let i = 0; i < 12; i++) { await act(async () => { await vi.advanceTimersByTimeAsync(5000) }) }
    expect(result.current.pending).toBe(false)
    // Pre-fix: the budget-exhausted publish() in pollForRun only patched
    // `pending`, leaving the 409 notice stuck forever even though the run
    // never landed.
    expect(result.current.notice).toBeNull()
  })
})
