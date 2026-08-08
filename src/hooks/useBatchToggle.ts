/**
 * useBatchToggle — apply a MULTI-value selection change through a host that only
 * exposes a per-value `onToggle(value)` callback.
 *
 * Why not a plain `values.forEach(onToggle)`: most toggle handlers in this codebase
 * are NON-functional setState closures — e.g. VacancySearchTab's
 * `setFunctions(selectedFunctions.includes(v) ? … : [...selectedFunctions, v])`, and
 * the same shape in CandidateSearchTab, ContactLinkSection and LocationBranchSection.
 * Called N times inside one tick, every call reads the SAME stale `selected`, so only
 * the last value survives: a "select all" that silently selects one option is exactly
 * the fake affordance §3 forbids. This hook therefore applies ONE value per commit —
 * each effect run toggles the head of the queue and re-schedules, so the host has
 * re-rendered (and handed down a fresh closure) before the next value goes through.
 * Hosts that already use functional updaters behave identically.
 *
 * Hosts that can set the whole selection in one call (workflow MultiSelectField's
 * `onChange(key, nextArray)`) do NOT need this — they apply the batch atomically.
 */
import { useEffect, useRef, useState } from 'react'

export function useBatchToggle<T extends string | number>(onToggle?: (value: T) => void) {
  const [queue, setQueue] = useState<T[]>([])
  const handlerRef = useRef(onToggle)

  // Keep the ref on the LATEST handler. Declared BEFORE the drain effect below, so
  // within one commit the ref is refreshed before the next queued value is applied.
  useEffect(() => { handlerRef.current = onToggle })

  // Drain exactly one value per commit (see the doc comment for why never a loop).
  useEffect(() => {
    if (queue.length === 0) return
    handlerRef.current?.(queue[0])
    setQueue(q => q.slice(1))
  }, [queue])

  // Queue a batch of values to toggle; an empty batch never triggers a render.
  return (values: T[]) => { if (values.length > 0) setQueue(prev => [...prev, ...values]) }
}

export default useBatchToggle
