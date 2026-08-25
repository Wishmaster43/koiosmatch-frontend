/**
 * RejectionSummary — the calm outcome card shown at the top of the Sollicitatie
 * tab once an application is rejected (Danny 25-07: the outcome belongs on the
 * first drill-down screen, the ORIGINAL reject form lives in a footer button +
 * confirm modal, see RejectionModal).
 *
 * APP-REJECTION-EDIT-1 (verified live: PATCH /applications/{id}/rejection
 * exists, ApplicationController::updateRejection): a small pencil reopens
 * RejectionModal in CORRECTION mode (prefilled reason + note), writing ONLY
 * rejection_reason_id/rejection_note — never the stage, never rejection_channel/
 * sent_at, so a correction can NEVER re-notify the candidate. Shown whenever the
 * application IS rejected (bucket === 'rejected', the same bucketOfPhase derivation
 * that mirrors the backend's own Application::isRejected() gate on this route) —
 * including the "no recorded reason" gap below, since the pencil is exactly how a
 * recruiter fills that in after the fact. Gated on applications.update (the same
 * permission the route itself requires), self-contained like InterviewStatusCard's
 * own auth gate — hidden entirely for a user who may not correct it, the backend
 * re-checks regardless (§7).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XCircle, Edit2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import SafeHtml from '@/components/ui/SafeHtml'
import { Caption } from '@/components/ui/typography'
import RejectionModal from './RejectionModal'
import type { RejectPayload } from './RejectionModal'
import type { ApplicationDetail } from '@/types/application'

// Soft-tint danger card (§4 recipe) — a colour-tinted card, never a solid fill.
const card = {
  borderRadius: 10, border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', padding: '12px 14px',
} as const

// Icon-only pencil — a compact 22x22 footprint (this card is small; mirrors the
// note-editor pencils elsewhere in RejectionModal at the same visual weight).
const pencilBtn = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--color-danger-text)', flexShrink: 0,
} as const

export default function RejectionSummary({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('applications.update') ?? false

  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // The corrected rejection once the PATCH resolves — null until then.
  const [corrected, setCorrected] = useState<ApplicationDetail['rejection'] | null>(null)

  // Alive guard, re-armed in SETUP (§9: StrictMode's double mount leaves a
  // cleanup-only ref permanently false and silently kills a later setState).
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // A fresh prop (the drawer's own refetch) is the newer truth and must not be
  // shadowed by a stale local correction (mirrors InterviewStatusCard's own
  // "fresh prop wins" guard).
  useEffect(() => { setCorrected(null) }, [a.rejection])

  // An application can sit in the rejected bucket WITHOUT a rejection record —
  // the phase picker (and the seeder) can move it there without a reason, which
  // is the gap APP-REJECT-GUARD-1 closes server-side. Show that state honestly
  // instead of rendering nothing, and offer the correction pencil to fill it in.
  const isRejected = a.bucket === 'rejected'
  if (!isRejected) return null
  const rejection = corrected ?? a.rejection

  // PATCH the reason/note only (see the component docblock) — the backend 404s
  // if the application isn't actually rejected, surfaced like any other failure.
  const handleCorrect = async (payload: RejectPayload) => {
    if (a.id == null || submitting) return
    setSubmitting(true)
    try {
      const res = await api.patch(`/applications/${a.id}/rejection`, { reason_id: payload.reason_id, note: payload.note })
      const fresh = unwrap<{ rejection?: ApplicationDetail['rejection'] }>(res)
      if (!alive.current) return
      // The full detail response resolves reason_label server-side; fall back to
      // the submitted payload (keeping the untouched channel/sent_at) only if the
      // response is ever missing the block, so the card never blanks after a save.
      setCorrected(fresh?.rejection ?? {
        reason_id: payload.reason_id, reason_label: payload.reason_label, note: payload.note,
        channel: rejection?.channel, sent_at: rejection?.sent_at,
      })
      setCorrectionOpen(false)
      notifySuccess(t('rejection.correctionDone'))
    } catch (err) {
      if (alive.current) notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  const correctPencil = canManage && (
    <button type="button" onClick={() => setCorrectionOpen(true)} style={pencilBtn}
      title={t('rejection.correctAction')} aria-label={t('rejection.correctAction')}>
      <Edit2 size={12} />
    </button>
  )

  if (!rejection) {
    return (
      <>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={16} color="var(--color-danger)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger-text)' }}>{t('rejection.rejected')}</span>
            </div>
            {correctPencil}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{t('rejection.noRecord')}</div>
        </div>
        {correctionOpen && (
          <RejectionModal application={a} mode="correct" submitting={submitting}
            onCancel={() => setCorrectionOpen(false)} onConfirm={handleCorrect} />
        )}
      </>
    )
  }

  const { reason_label: reasonLabel, reason_id: reasonId, note, channel, sent_at: sentAt } = rejection
  // An unknown/renamed tenant channel still shows its raw value via defaultValue,
  // instead of a missing-key string.
  const channelLabel = channel ? t(`rejection.channels.${channel}`, { defaultValue: channel }) : ''
  // Join only the parts that actually exist — never a dangling ' · ' separator.
  const metaParts = [
    sentAt ? t('rejection.sentOn', { date: formatDate(sentAt) }) : t('rejection.notSent'),
    channel ? t('rejection.viaChannel', { channel: channelLabel }) : '',
  ].filter(Boolean)

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={16} color="var(--color-danger)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger-text)' }}>{t('rejection.rejected')}</span>
          </div>
          {correctPencil}
        </div>
        {reasonLabel && (
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6 }}>{reasonLabel}</div>
        )}
        <Caption as="div" style={{ marginTop: 4 }}>{metaParts.join(' · ')}</Caption>
        {note && (
          <div style={{ marginTop: 8 }}>
            <Caption as="div" style={{ marginBottom: 4 }}>{t('rejection.note')}</Caption>
            <SafeHtml html={note} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
          </div>
        )}
      </div>
      {correctionOpen && (
        <RejectionModal application={a} mode="correct" submitting={submitting}
          initialReasonId={reasonId != null ? String(reasonId) : ''} initialNote={note ?? ''}
          onCancel={() => setCorrectionOpen(false)} onConfirm={handleCorrect} />
      )}
    </>
  )
}
