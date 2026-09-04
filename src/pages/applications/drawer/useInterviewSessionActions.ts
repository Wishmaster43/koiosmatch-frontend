// Extracted from InterviewStatusCard (SIZE-SPLIT-B, zero behaviour change):
// the stop/resume interview state machine — server-derived refresh, the 404
// "no running session" notice, and the busy guard around both POSTs.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mapInterview } from '../data/mapApplication'
import type { ApiApplication, ApplicationInterview } from '@/types/application'
import type { Id } from '@/types/common'

// INTERVIEW-STOP-1 (see the module doc in InterviewStatusCard.tsx): both
// routes target the APPLICATION id, never the session id.
export function useInterviewSessionActions({
  interview, applicationId, canManage,
}: { interview: ApplicationInterview | null; applicationId?: Id; canManage: boolean }) {
  const { t } = useTranslation('applications')

  // Session state as the SERVER last reported it (action response + refetch);
  // null = "nothing newer than the prop". Plus the 404 "no interview running"
  // notice, which is informative, never a permanent disable.
  const [refreshed, setRefreshed] = useState<ApplicationInterview | null>(null)
  const [noSession, setNoSession] = useState(false)
  const [busy, setBusy] = useState(false)

  // Alive guard, re-armed in SETUP (§9: a cleanup-only ref stays false after
  // StrictMode's double mount and silently kills every later setState).
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  // A fresh prop wins over our local copy: once the drawer refetches the
  // application, its data is the newer truth and this card must not shadow it.
  useEffect(() => { setRefreshed(null); setNoSession(false) }, [interview])

  // Re-read this application's interview block after a successful action: the
  // action response only says paused/active, while `turn` and the pause
  // metadata are derived server-side.
  const refreshInterview = async () => {
    if (applicationId == null) return
    try {
      const res = await api.get(`/applications/${applicationId}`, { params: { include_archived: 1 } })
      const fresh = mapInterview(unwrap<ApiApplication>(res)?.interview)
      if (alive.current && fresh) setRefreshed(fresh)
    } catch {
      // The action itself already succeeded; keep the response-derived state
      // rather than reverting to a stale prop or claiming a failure.
    }
  }

  // One runner for both directions — identical seam, different copy. Real POST
  // to the real route; the server's own verdict drives the new category.
  const runAction = async (route: 'stop-interview' | 'resume-interview', successKey: string, failedKey: string) => {
    if (busy || applicationId == null) return
    setBusy(true)
    setNoSession(false)
    try {
      const res = await api.post(`/applications/${applicationId}/${route}`)
      const body = unwrap<{ status?: string; paused_at?: string | null }>(res)
      const paused = body?.status === 'paused'
      if (!alive.current) return
      // Paused ⇒ the backend derives turn='recruiter' from paused_at, so that
      // is reported, not guessed. Resumed ⇒ only the refetch knows the turn.
      // Non-null: this runner only fires from onStop/onResume, both gated on a
      // live `interview` by canStop/canResume below.
      setRefreshed(prev => ({
        ...(prev ?? interview)!,
        category: paused ? 'paused' : 'busy',
        pausedAt: body?.paused_at ?? null,
        turn: paused ? 'recruiter' : null,
      }))
      notifySuccess(t(successKey))
      await refreshInterview()
    } catch (err) {
      if (!alive.current) return
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        // Business reply, not a missing route: no open interview session for
        // this application. Say so; stay retryable.
        setNoSession(true)
        notifyError(t('interview.status.noRunningSession'))
      } else if (status === 403) {
        // Permission revoked since the drawer opened — the backend is the authority.
        notifyError(t('interview.status.notAllowed'))
      } else {
        notifyError(extractApiError(err, t(failedKey)))
      }
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const live = refreshed ?? interview
  const category = live?.category
  const turn = live?.turn

  // Operable whenever there is an application to target and the session looks
  // live — no session-id precondition (neither route takes one).
  const canStop = canManage && category === 'busy' && applicationId != null && turn !== 'recruiter'
  const stopDisabledReason = !canManage ? null
    : turn === 'recruiter' ? null
    : category !== 'busy' ? t('interview.status.takeoverNotActive')
    : applicationId == null ? t('interview.status.takeoverUnavailable')
    : null

  const canResume = canManage && category === 'paused' && applicationId != null
  const resumeDisabledReason = applicationId == null ? t('interview.status.resumeUnavailable') : null

  // Pause the AI so the recruiter answers, and hand it back — same runner.
  const onStop = () => { if (canStop) void runAction('stop-interview', 'interview.status.takeoverSuccess', 'interview.status.takeoverFailed') }
  const onResume = () => { if (canResume) void runAction('resume-interview', 'interview.status.resumeSuccess', 'interview.status.resumeFailed') }

  return { refreshed, noSession, busy, canStop, stopDisabledReason, canResume, resumeDisabledReason, onStop, onResume }
}
