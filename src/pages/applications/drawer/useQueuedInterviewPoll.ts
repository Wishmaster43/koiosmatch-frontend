/**
 * useQueuedInterviewPoll (E2-QUEUED, GEO-POLL-1 idiom) — after the interview start answered
 * 202 queued, polls the application until the session exists or an honest cap is reached.
 * The alive guard is re-armed in the effect SETUP (StrictMode runs setup, cleanup, setup).
 */
import { useEffect, useRef, useState } from 'react'
import type { ApplicationInterview } from '@/types/application'
import type { Id } from '@/types/common'

// Backoff of roughly 2.5 minutes over 12 reads: a queued worker may sleep, but the poll must end.
export const QUEUED_INTERVIEW_POLL_DELAYS_MS = [2000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, 20000, 30000, 30000]

/** One poll read: the session landed, the queue skipped the start, or nothing yet (null). */
export type QueuedPollResult = { kind: 'landed'; iv: ApplicationInterview } | { kind: 'skipped' }

interface Options {
  applicationId: Id | undefined
  /** The queued run id; null/undefined means nothing is waiting. */
  runId: string | null | undefined
  /** Reads the application and returns its mapped interview, or null while the session does not exist. */
  fetchInterview: () => Promise<QueuedPollResult | null>
  /** Called once with the landed session. */
  onLanded: (iv: ApplicationInterview) => void
  /** Called once when the queue refused the start. */
  onSkipped?: () => void
}

export function useQueuedInterviewPoll({ applicationId, runId, fetchInterview, onLanded, onSkipped }: Options) {
  const [capped, setCapped] = useState(false)
  // Latest callbacks live in refs so a re-render never restarts the poll.
  const fetchRef = useRef(fetchInterview)
  const landedRef = useRef(onLanded)
  const skippedRef = useRef(onSkipped)
  useEffect(() => { fetchRef.current = fetchInterview; landedRef.current = onLanded; skippedRef.current = onSkipped })

  useEffect(() => {
    setCapped(false)
    if (!runId || applicationId == null) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    // One read per delay step; a failed read just waits for the next step.
    const step = (i: number) => {
      if (i >= QUEUED_INTERVIEW_POLL_DELAYS_MS.length) { if (alive) setCapped(true); return }
      timer = setTimeout(async () => {
        const r = await fetchRef.current().catch(() => null)
        if (!alive) return
        if (r?.kind === 'landed') landedRef.current(r.iv)
        else if (r?.kind === 'skipped') skippedRef.current?.()
        else step(i + 1)
      }, QUEUED_INTERVIEW_POLL_DELAYS_MS[i])
    }
    step(0)
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [applicationId, runId])

  return { capped }
}
