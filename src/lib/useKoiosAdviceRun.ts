/**
 * useKoiosAdviceRun — starts one real Koios AI advice run for a record
 * (S1 K-266/K-267: `POST /{entityPath}/{id}/koios-advice`) and polls the record
 * afterwards so the advice card can show the real result without a manual page
 * reload. API-CREDITS-1: this is the ONLY trigger for a real AI call on these
 * five entities (candidates/applications/vacancies/customers/matches) — never
 * fired automatically, only from the host's "Advies vernieuwen" button.
 *
 * S1 REPAIR NOTE 3 (a paid run must not be lost on tab switch): the run's
 * pending/notice/fresh-advice state lives in a MODULE-SCOPE map keyed by
 * "<entityPath>:<id>", not per-component useState — a React unmount (drawer
 * tab switch) never cancels the poll below, and a remount (or a sibling
 * showing the same record) picks up mid-poll or the already-landed result
 * instead of silently losing a call that already cost real Anthropic credits.
 * Never evicted: a session's worth of touched records is a handful of small
 * objects, not a real memory concern.
 *
 * Staleness: the hook also accepts the record's OWN current
 * `koiosAiAdvice.runId` (as the host's prop already shows it). The FIRST time
 * a key is seen, that value is the baseline; if it later changes to a THIRD
 * runId — neither the baseline nor our own cached run's id — a bulk/workflow
 * run produced a newer result somewhere else, so the local override is
 * dropped and the (now fresher) prop wins instead of a stuck cache.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { mapKoiosAiAdvice, type ApiKoiosAiAdvice, type KoiosAiAdvice } from '@/lib/koiosAdviceMap'
import type { Id } from '@/types/common'

const POLL_INTERVAL_MS = 5000
const POLL_MAX_TICKS = 12

// The publicly-exposed slice of a run's state — always a FRESH object on
// change (never mutated in place): useSyncExternalStore re-renders on
// reference inequality between successive getSnapshot() calls.
interface RunSnapshot {
  pending: boolean
  notice: string | null
  // undefined = nothing fresher than the record's own prop has landed yet.
  advice: KoiosAiAdvice | undefined
}
const EMPTY_SNAPSHOT: RunSnapshot = { pending: false, notice: null, advice: undefined }

interface RunState {
  snapshot: RunSnapshot
  bootstrapRunId: string | null | undefined // undefined = not yet observed
  gen: number
  listeners: Set<() => void>
}
const runStates = new Map<string, RunState>()
const keyOf = (entityPath: string, id: Id | undefined) => `${entityPath}:${id}`

function getState(key: string): RunState {
  let s = runStates.get(key)
  if (!s) { s = { snapshot: EMPTY_SNAPSHOT, bootstrapRunId: undefined, gen: 0, listeners: new Set() }; runStates.set(key, s) }
  return s
}
// Replace the snapshot (new reference) and wake every mounted subscriber.
function publish(s: RunState, patch: Partial<RunSnapshot>) {
  s.snapshot = { ...s.snapshot, ...patch }
  s.listeners.forEach(l => l())
}

interface RunStartResponse { run_id?: string }

// Poll GET /{entityPath}/{id} every 5s (up to 12 times) until `runId` shows up
// on koios_ai_advice.run_id, or the budget ends. A plain module function
// (never a hook) so it needs no aliveRef/unmount guard — see the file doc.
// Both terminal publishes below clear `notice`: a notice describes the
// REQUEST that started (or refused) a run (e.g. the 409 "already running"
// caption) — once the run has ENDED that caption would sit under a card that
// already moved on, contradicting it.
function pollForRun(entityPath: string, id: Id, key: string, runId: string | null, gen: number, ticksLeft: number) {
  const s = getState(key)
  if (gen !== s.gen) return
  if (ticksLeft <= 0) { publish(s, { pending: false, notice: null }); return }
  setTimeout(async () => {
    if (gen !== s.gen) return
    try {
      const raw = unwrap<{ koios_ai_advice?: ApiKoiosAiAdvice | null }>(await api.get(`/${entityPath}/${id}`))
      const fresh = mapKoiosAiAdvice(raw?.koios_ai_advice)
      if (gen !== s.gen) return
      if (runId && fresh?.runId === runId) { publish(s, { pending: false, notice: null, advice: fresh ?? undefined }); return }
    } catch {
      // A transient poll failure never aborts the run — just try again next tick.
    }
    pollForRun(entityPath, id, key, runId, gen, ticksLeft - 1)
  }, POLL_INTERVAL_MS)
}

export function useKoiosAdviceRun(
  entityPath: string,
  id: Id | undefined,
  // The record's own current koiosAiAdvice.runId, for staleness detection only.
  recordRunId?: string | null,
) {
  const { t } = useTranslation('common')
  const key = keyOf(entityPath, id)

  const subscribe = useCallback((cb: () => void) => {
    const s = getState(key)
    s.listeners.add(cb)
    return () => { s.listeners.delete(cb) }
  }, [key])
  const snapshot = useSyncExternalStore(subscribe, () => getState(key).snapshot)

  // Staleness (see file doc): drop a cached override once the record's own
  // prop shows a run we did not start ourselves and that isn't the baseline.
  // The baseline is whatever the record showed at FIRST SIGHT of this key —
  // on the matches host that is `null` (the compact row carries
  // `runId: null` until the detail fetch lands) — and it only moves again
  // inside the clear branch below, when a foreign run supersedes it.
  useEffect(() => {
    const s = getState(key)
    if (s.bootstrapRunId === undefined) { s.bootstrapRunId = recordRunId ?? null; return }
    if (s.snapshot.advice && recordRunId && recordRunId !== s.bootstrapRunId && recordRunId !== s.snapshot.advice.runId) {
      s.bootstrapRunId = recordRunId
      publish(s, { advice: undefined })
    }
  }, [key, recordRunId])

  // A notice belongs to the ATTEMPT that produced it, not to the record: the
  // module-scope store is never evicted (file doc), so without this a
  // finished attempt's 409/422/403/5xx caption would re-render on every later
  // remount of this record's drawer for the rest of the session. Never clears
  // while pending — a 409 keeps its "already running" notice up while we poll
  // for that same run.
  useEffect(() => {
    const s = getState(key)
    if (!s.snapshot.pending && s.snapshot.notice) publish(s, { notice: null })
  }, [key])

  // Start one advice run. 202 = accepted (poll for it); 409 = a run is already
  // in flight for this record (poll for THAT run instead — same UX, an honest
  // notice); 403 = the module gate refused (koios_ai off — the FE gate should
  // already hide the button, this is the honest fallback if it slips); 422 =
  // template missing/inactive (server message); anything else (5xx/network)
  // gets the generic actionFailed notice.
  const request = useCallback(async () => {
    if (id == null) return
    const s = getState(key)
    if (s.snapshot.pending) return
    const gen = ++s.gen
    publish(s, { pending: true, notice: null })
    try {
      // quietStatuses: the hook renders its own notice — never the
      // interceptor's generic dev toast on top of it (api.ts A-7).
      const res = unwrap<RunStartResponse>(
        await api.post(`/${entityPath}/${id}/koios-advice`, undefined, { quietStatuses: [403, 409, 422] }),
      )
      pollForRun(entityPath, id, key, res?.run_id ?? null, gen, POLL_MAX_TICKS)
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        const runId = (e as { response?: { data?: { run_id?: string } } })?.response?.data?.run_id ?? null
        publish(s, { notice: t('koios.advice.alreadyRunning') })
        pollForRun(entityPath, id, key, runId, gen, POLL_MAX_TICKS)
        return
      }
      if (status === 422) { publish(s, { notice: extractApiError(e, t('koios.advice.unavailable')), pending: false }); return }
      if (status === 403) { publish(s, { notice: t('koios.advice.unavailable'), pending: false }); return }
      publish(s, { notice: extractApiError(e, t('actionFailed')), pending: false })
    }
  }, [entityPath, id, key, t])

  return { request, pending: snapshot.pending, notice: snapshot.notice, freshAdvice: snapshot.advice }
}
