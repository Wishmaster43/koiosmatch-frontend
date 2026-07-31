import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Hand, PlayCircle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { BTN_H } from '@/config/buttonMetrics'
import { interviewCategoryColor } from '../data/applicationsShared'
import { mapInterview } from '../data/mapApplication'
import type { ApiApplication, ApplicationInterview } from '@/types/application'
import type { Id } from '@/types/common'

// Soft-chip colour per turn (§4 semantic tokens, never ad-hoc hex) — who is
// currently expected to act in the conversation.
const TURN_COLOR: Record<string, string> = {
  agent: 'var(--color-info)',
  candidate: 'var(--color-primary)',
  // Finished: nobody is on turn, so it reads as neutral, not as a call to act.
  completed: 'var(--text-muted)',
  pending: 'var(--text-muted)',
  recruiter: 'var(--color-success)',
}

/**
 * resolveDurationSeconds — the live duration: prefer the explicit seconds field
 * (once the backend sends it), else derive it from started_at → (ended_at ??
 * last_message_at). Null when neither timing signal is present — never a
 * guessed number. Pure/exported so the derivation is unit-testable without
 * rendering (no lib/datetime dependency — out of scope for this task).
 */
export function resolveDurationSeconds(iv: ApplicationInterview): number | null {
  if (iv.durationSeconds != null) return iv.durationSeconds
  const end = iv.endedAt ?? iv.lastMessageAt
  if (!iv.startedAt || !end) return null
  const start = new Date(iv.startedAt).getTime()
  const stop = new Date(end).getTime()
  if (Number.isNaN(start) || Number.isNaN(stop)) return null
  return Math.max(0, Math.round((stop - start) / 1000))
}

/** splitDuration — whole seconds → {hours, minutes}, the two i18n placeholders. */
export function splitDuration(totalSeconds: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

const cardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
}

const actionBtnStyle = (active: boolean, danger: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 12, fontWeight: 500, height: BTN_H, padding: '0 12px', borderRadius: 8,
  border: `1px solid ${active ? (danger ? 'var(--color-danger)' : 'var(--color-primary)') : 'var(--border)'}`,
  background: 'none', color: active ? (danger ? 'var(--color-danger)' : 'var(--color-primary)') : 'var(--text-muted)',
  cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.6,
})

/**
 * InterviewStatusCard — the compact "who's talking to whom, right now" summary
 * for the live interview session: agent, flow, turn, step and total duration.
 * Every visibility field stays optional, so a payload that carries only
 * category/step/total still renders the calm branches instead of inventing a
 * value (§3 no fake affordances).
 *
 * INTERVIEW-STOP-1 is LIVE (measured 31-07). `POST /applications/{id}/stop-interview`
 * and `POST /applications/{id}/resume-interview` are registered inside the tenant
 * group behind `permission:applications.update` and answer `{status: 'paused' |
 * 'active', paused_at}`. Consequences encoded below:
 *  · both routes target the APPLICATION id — the interview session id is never sent,
 *    so the buttons do NOT gate on `interview.id` (the LIST payload has no session id,
 *    which made the control read "unavailable" until the detail fetch landed);
 *  · a 404 is the backend's ordinary "no open interview session for this application"
 *    reply — it shows a notice and the control stays retryable, it does NOT mean the
 *    route is missing (that stale reading permanently killed the button);
 *  · the action responses carry only status/paused_at, so a success reconciles from a
 *    `GET /applications/{id}` refetch — the backend derives `turn` (and who paused)
 *    itself, and this card must show that, not a local guess.
 */
export default function InterviewStatusCard({ interview, applicationId }: { interview: ApplicationInterview | null; applicationId?: Id }) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  // Mirrors ApplicationsPage's own canManage gate and the route's own
  // `permission:applications.update` middleware — same permission string, same
  // source of truth. The backend re-checks (403); the UI only hides what the
  // user may not do.
  const canManage = auth?.hasPermission?.('applications.update') ?? false

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

  // No session at all yet — a calm placeholder, not an empty blank area.
  if (!interview) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('interview.status.none')}</span>
      </div>
    )
  }

  const live = refreshed ?? interview
  const category = live.category
  const turn = live.turn
  const durationSeconds = resolveDurationSeconds(live)
  const duration = durationSeconds != null ? splitDuration(durationSeconds) : null
  // True once the backend has actually sent ANY INTERVIEW-VISIBILITY-1 field —
  // until then, show ONE calm notice instead of four separate "unknown" chips.
  const hasVisibilityData = Boolean(live.agent || live.flowName || live.turn || durationSeconds != null)

  // Operable whenever there is an application to target and the session looks
  // live — no session-id precondition (neither route takes one). `applicationId`
  // is the only hard requirement: without it there is literally no URL to call.
  const canStop = canManage && category === 'busy' && applicationId != null && turn !== 'recruiter'
  const stopDisabledReason = !canManage ? null
    : turn === 'recruiter' ? null
    : category !== 'busy' ? t('interview.status.takeoverNotActive')
    : applicationId == null ? t('interview.status.takeoverUnavailable')
    : null

  const canResume = canManage && category === 'paused' && applicationId != null
  const resumeDisabledReason = applicationId == null ? t('interview.status.resumeUnavailable') : null

  // Re-read this application's interview block after a successful action: the
  // action response only says paused/active, while `turn` and the pause metadata
  // are derived server-side. `include_archived` mirrors the drawer's own fetch —
  // it only widens the lookup, never narrows an active row's.
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
      // Paused ⇒ the backend derives turn='recruiter' from paused_at, so that is
      // reported, not guessed. Resumed ⇒ it derives agent-vs-candidate from the
      // last message direction, which only the refetch knows — so blank the turn
      // instead of showing a made-up one.
      setRefreshed(prev => ({
        ...(prev ?? interview),
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
        // Business reply, not a missing route: no open interview session for this
        // application (or an id this tenant cannot see). Say so; stay retryable.
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

  // Pause the AI so the recruiter answers, and hand it back — same runner.
  const onStop = () => { if (canStop) void runAction('stop-interview', 'interview.status.takeoverSuccess', 'interview.status.takeoverFailed') }
  const onResume = () => { if (canResume) void runAction('resume-interview', 'interview.status.resumeSuccess', 'interview.status.resumeFailed') }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Agent identity — honest "unknown agent" while the field is unconfirmed. */}
        <Avatar initials={(live.agent?.name?.[0] ?? '?').toUpperCase()} size={26} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {live.agent?.name || t('interview.status.noAgent')}
          </span>
          {live.flowName && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{live.flowName}</span>}
        </div>

        {/* Turn — soft chip, colour + TEXT (never colour-only, §6 a11y). */}
        {turn && <SoftChip label={t(`interview.status.turn.${turn}`)} color={TURN_COLOR[turn]} round />}

        {/* Category + step (INTERVIEW-PHASE-1 — already real today). */}
        <StatusPill label={t(`interview.category.${category}`)} color={interviewCategoryColor(category)} />
        {live.total > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('interview.stepOf', { step: live.step ?? '–', total: live.total })}
          </span>
        )}

        {/* Total conversation duration — the value sits in its OWN span so the
            label and the value stay two distinct, independently queryable nodes. */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('interview.status.duration')}:{' '}
          <span>
            {duration ? (
              duration.hours > 0
                ? t('interview.status.durationHours', duration)
                : t('interview.status.durationMinutes', { count: duration.minutes })
            ) : t('interview.status.durationUnknown')}
          </span>
        </span>
      </div>

      {!hasVisibilityData && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('interview.status.visibilityPending')}
        </span>
      )}

      {/* Stop/takeover + resume — authorization-gated (hidden, not just disabled,
          for a user who may not manage this application). Resume only shows once
          the session is actually paused; stop always shows (disabled otherwise),
          mirroring the original single-button precedent. */}
      {canManage && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onStop} disabled={!canStop || busy}
            aria-label={t('interview.status.takeover')} title={stopDisabledReason ?? undefined}
            style={actionBtnStyle(canStop, true)}>
            <Hand size={12} />
            {busy ? t('interview.status.takeoverBusy') : t('interview.status.takeover')}
          </button>
          {category === 'paused' && (
            <button type="button" onClick={onResume} disabled={!canResume || busy}
              aria-label={t('interview.resume')} title={resumeDisabledReason ?? undefined}
              style={actionBtnStyle(canResume, false)}>
              <PlayCircle size={12} />
              {busy ? t('interview.status.resumeBusy') : t('interview.resume')}
            </button>
          )}
        </div>
      )}

      {/* The 404 answer, in words: this application has no running interview
          (any more). Informative — the buttons above stay clickable. */}
      {noSession && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('interview.status.noRunningSession')}
        </span>
      )}
    </div>
  )
}
