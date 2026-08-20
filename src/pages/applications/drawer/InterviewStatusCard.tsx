import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Hand, PlayCircle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
// HUISSTIJL-1: shared typography atom — the three plain 11px/muted lines
// below are exact matches for the house Caption scale.
import { Caption } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { humanizeInterviewStatus, translateInterviewStatus } from '@/lib/interviewStatus'
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
 * resolveDurationSeconds — ELAPSED seconds since the session started, NOT how
 * long the conversation took: the backend measures created_at → completed_at ??
 * now(), so an overnight WhatsApp thread legitimately reads as days. Prefer that
 * explicit field (detail contract); otherwise derive the same span from
 * started_at → (endedAt ?? lastMessageAt), which is all a list payload could
 * offer. Null when no timing signal exists — never a guessed number. Pure/
 * exported so the derivation is unit-testable without rendering.
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

/**
 * splitDuration — whole seconds → {days, hours, minutes}. Days exist because this
 * is wall-clock elapsed time: a thread answered the next morning is ~14 hours and
 * one answered after a weekend is days, and "96u 15min" is unreadable. `hours` is
 * the remainder within the day, so days+hours+minutes always describe one span.
 */
export function splitDuration(totalSeconds: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60))
  const totalHours = Math.floor(totalMinutes / 60)
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24, minutes: totalMinutes % 60 }
}

const cardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
}

// Re-exported for compat: existing importers (ApplicationStatusStrip, this
// file's own tests) still pull humanizeInterviewStatus from here. The real
// definition + its i18n-first sibling `translateInterviewStatus` now live in
// `@/lib/interviewStatus`, shared with every other render site (RAW-ENUM-LEAK
// fix, HUISSTIJL-1 batch G — InterviewFlowSection was rendering the raw value).
export { humanizeInterviewStatus }

// Decorative separator between the meta line's segments — hidden from assistive
// tech since every segment around it already carries its own accessible text.
const MetaDot = () => <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>

// BUTTON-SOFT-TINT-1 (Danny 05-08): the active state was a white/transparent
// outline button — now the house soft-tint recipe (§4, mirrors DrawerAddButton/
// QuickViewToggle). The inactive/disabled state stays a neutral, unfilled ghost
// (§3 honest gate — it carries no colour meaning while disabled).
// PRIMAIR-VLAK-1 + maatwet (Danny 19/20-08): accent action = the solid trio at
// the sm drill-down height; danger keeps its red tint (his reconfirmed rule).
const actionBtnStyle = (active: boolean, danger: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 12, fontWeight: danger ? 500 : 600, height: 28, padding: '0 10px', borderRadius: 6,
  border: !active ? '1px solid var(--border)'
    : danger ? '1px solid color-mix(in srgb, var(--color-danger) 33%, transparent)'
    : '1px solid var(--button-border)',
  background: !active ? 'none'
    : danger ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
    : 'var(--button-fill)',
  color: !active ? 'var(--text-muted)' : danger ? 'var(--color-danger)' : 'var(--button-ink)',
  cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.6,
})

/**
 * InterviewStatusCard — the compact "who's talking to whom, right now" summary
 * for the live interview session: agent, flow, turn, step and elapsed time.
 * Every visibility field stays optional, so a payload that carries only
 * category/step/total still renders the calm branches instead of inventing a
 * value (§3 no fake affordances).
 *
 * INTERVIEW-VISIBILITY-1 is LIVE (measured 01-08 in InterviewSessionResource):
 * `flow_name` comes off the flow relation and the agent is resolved
 * DETERMINISTICALLY (InterviewSession::resolveAgent — vacancy-coupled agent, then
 * the flow's persona, then the oldest agent on the flow ordered by created_at,
 * id), so both are presented plainly here. This card is DRAWER-ONLY on purpose:
 * `agent`, `turn` and `duration_seconds` exist only on the detail resource, so no
 * table, board or KPI may render them.
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
  // True when this payload carries ANY of the visibility fields. The detail
  // contract always does, so in the drawer this is effectively always true; a
  // block reduced to category/step (a list-shaped object handed in) gets ONE calm
  // notice instead of four separate "unknown" chips.
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
      {/* I1 (Danny 08-08 screenshot): ONE calm meta line — avatar, name, flow,
          status chip, turn chip, step, current status — instead of the previous
          layout where the agent/flow sat in their own stacked title+subtitle
          block and pushed the chips onto separately wrapped lines. Every segment
          stays its OWN text node (so exact-text lookups and i18n keys are
          unaffected) joined visually by a middle dot; the row wraps as a group
          only once it truly runs out of horizontal room. Elapsed time moves to
          its own line below — it isn't part of this "who/where" summary and its
          long phrase was itself crowding the rest off the row. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Agent identity, stated plainly: the backend resolves the running agent
            deterministically (vacancy-coupled → flow persona → oldest by
            created_at/id), so the name is a fact, not a best guess. "Unknown
            agent" only for a payload that carries no agent at all (list rows). */}
        <Avatar initials={(live.agent?.name?.[0] ?? '?').toUpperCase()} size={26} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {live.agent?.name || t('interview.status.noAgent')}
        </span>
        {/* The flow's own name (interview_flows.name) — tenant-authored, so it may
            already read e.g. "Zorgintake (9 stappen)" on its own. */}
        {live.flowName && (
          <>
            <MetaDot />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{live.flowName}</span>
          </>
        )}

        {/* Turn — soft chip, colour + TEXT (never colour-only, §6 a11y). */}
        {turn && <SoftChip label={t(`interview.status.turn.${turn}`)} color={TURN_COLOR[turn]} round />}

        {/* Category (INTERVIEW-PHASE-1 — already real today). */}
        <StatusPill label={t(`interview.category.${category}`)} color={interviewCategoryColor(category)} />

        {/* DD-FE-11 (08-08 drill-down audit, "Stap 2 van 12" read as the ONLY
            signal): the flow's own current-step NAME is now the PRIMARY
            progress readout — see @/lib/interviewStatus for why an
            unknown flow-authored value is never shown raw. The numeric
            position is kept, but demoted to a small muted suffix right after
            the name (never dropped) — mirrors the equally-ordered interview
            cell in ApplicationStatusStrip (name main, step count muted after).
            ONE dot introduces the whole progress unit; the row's own `gap`
            already spaces the name/count pair inside it. */}
        {(live.currentStatus || live.total > 0) && <MetaDot />}
        {live.currentStatus && (
          <span style={{ fontSize: 12, color: 'var(--text)' }}>
            {translateInterviewStatus(t, live.currentStatus)}
          </span>
        )}
        {live.total > 0 && (
          <Caption>
            {t('interview.stepOf', { step: live.step ?? '–', total: live.total })}
          </Caption>
        )}
      </div>

      {/* ELAPSED time since the interview started — deliberately NOT called
          conversation duration: the backend counts wall clock from session
          creation, so nights and weekends are inside this number. The tooltip
          spells that out; the value sits in its OWN span so label and value
          stay two distinct, independently queryable nodes. */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={t('interview.status.durationHint')}>
        {t('interview.status.duration')}:{' '}
        <span>
          {duration ? (
            duration.days > 0
              ? t('interview.status.durationDays', duration)
              : duration.hours > 0
                ? t('interview.status.durationHours', duration)
                : t('interview.status.durationMinutes', { count: duration.minutes })
          ) : t('interview.status.durationUnknown')}
        </span>
      </span>

      {!hasVisibilityData && (
        <Caption style={{ fontStyle: 'italic' }}>
          {t('interview.status.visibilityPending')}
        </Caption>
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
        <Caption style={{ fontStyle: 'italic' }}>
          {t('interview.status.noRunningSession')}
        </Caption>
      )}
    </div>
  )
}
