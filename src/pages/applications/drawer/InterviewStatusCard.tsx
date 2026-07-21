import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Hand } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { BTN_H } from '@/config/buttonMetrics'
import { interviewCategoryColor } from '../data/applicationsShared'
import type { ApplicationInterview } from '@/types/application'

// Soft-chip colour per turn (§4 semantic tokens, never ad-hoc hex) — who is
// currently expected to act in the conversation.
const TURN_COLOR: Record<string, string> = {
  agent: 'var(--color-info)',
  candidate: 'var(--color-primary)',
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

/**
 * InterviewStatusCard — the compact "who's talking to whom, right now" summary
 * for the live interview session: agent, flow, turn, step and total duration
 * (INTERVIEW-VISIBILITY-1, speculative — Danny 21-07). Built against the
 * PROPOSED contract; every new field is optional so today's real payload
 * (which only sends category/step/total) renders the calm/honest branches
 * instead of crashing or inventing a value (§3 no fake affordances).
 */
export default function InterviewStatusCard({ interview }: { interview: ApplicationInterview | null }) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  // Mirrors ApplicationsPage's own canManage gate (applications.update) — this
  // component can't read ApplicationDrawer's prop (another agent owns that file
  // right now), so it checks the permission directly, same source of truth.
  const canManage = auth?.hasPermission?.('applications.update') ?? false

  // Optimistic "you just took over" override, plus a client-confirmed "the
  // takeover endpoint doesn't exist yet" flag — set only after a REAL 404, never
  // assumed up front (the honest-gate reacts to the actual response).
  const [turnOverride, setTurnOverride] = useState<'recruiter' | null>(null)
  const [takeoverUnavailable, setTakeoverUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)

  // No session at all yet — a calm placeholder, not an empty blank area.
  if (!interview) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('interview.status.none')}</span>
      </div>
    )
  }

  const turn = turnOverride ?? interview.turn
  const durationSeconds = resolveDurationSeconds(interview)
  const duration = durationSeconds != null ? splitDuration(durationSeconds) : null
  // True once the backend has actually sent ANY INTERVIEW-VISIBILITY-1 field —
  // until then, show ONE calm notice instead of four separate "unknown" chips.
  const hasVisibilityData = Boolean(interview.agent || interview.flowName || interview.turn || durationSeconds != null)

  const canTakeOver = canManage && interview.category === 'busy' && interview.id != null && !takeoverUnavailable && turn !== 'recruiter'
  const disabledReason = !canManage ? null
    : turn === 'recruiter' ? null
    : interview.category !== 'busy' ? t('interview.status.takeoverNotActive')
    : (interview.id == null || takeoverUnavailable) ? t('interview.status.takeoverUnavailable')
    : null

  // Real POST — no fake affordance (§3): this really calls the proposed
  // endpoint. A 404 (endpoint not shipped yet) disables the button honestly;
  // any other failure surfaces a message but stays retryable.
  const onTakeover = async () => {
    if (!canTakeOver || busy) return
    setBusy(true)
    try {
      await api.post(`/interviews/${interview.id}/takeover`)
      setTurnOverride('recruiter')
      notifySuccess(t('interview.status.takeoverSuccess'))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setTakeoverUnavailable(true)
        notifyError(t('interview.status.takeoverUnavailable'))
      } else {
        notifyError(extractApiError(err, t('interview.status.takeoverFailed')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Agent identity — honest "unknown agent" while the field is unconfirmed. */}
        <Avatar initials={(interview.agent?.name?.[0] ?? '?').toUpperCase()} size={26} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {interview.agent?.name || t('interview.status.noAgent')}
          </span>
          {interview.flowName && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{interview.flowName}</span>}
        </div>

        {/* Turn — soft chip, colour + TEXT (never colour-only, §6 a11y). */}
        {turn && <SoftChip label={t(`interview.status.turn.${turn}`)} color={TURN_COLOR[turn]} round />}

        {/* Category + step (INTERVIEW-PHASE-1 — already real today). */}
        <StatusPill label={t(`interview.category.${interview.category}`)} color={interviewCategoryColor(interview.category)} />
        {interview.total > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('interview.stepOf', { step: interview.step ?? '–', total: interview.total })}
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

      {/* Stop/takeover — authorization-gated (hidden, not just disabled, for a
          user who may not manage this application). */}
      {canManage && (
        <button type="button" onClick={onTakeover} disabled={!canTakeOver || busy}
          aria-label={t('interview.status.takeover')} title={disabledReason ?? undefined}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            fontSize: 12, fontWeight: 500, height: BTN_H, padding: '0 12px', borderRadius: 8,
            border: `1px solid ${canTakeOver ? 'var(--color-danger)' : 'var(--border)'}`, background: 'none',
            color: canTakeOver ? 'var(--color-danger)' : 'var(--text-muted)',
            cursor: canTakeOver && !busy ? 'pointer' : 'not-allowed', opacity: canTakeOver ? 1 : 0.6,
          }}>
          <Hand size={12} />
          {busy ? t('interview.status.takeoverBusy') : t('interview.status.takeover')}
        </button>
      )}
    </div>
  )
}
