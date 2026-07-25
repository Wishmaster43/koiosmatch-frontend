import { useTranslation } from 'react-i18next'
import { XCircle } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import SafeHtml from '@/components/ui/SafeHtml'
import type { ApplicationDetail } from '@/types/application'

// Soft-tint danger card (§4 recipe) — a colour-tinted card, never a solid fill.
const card = {
  borderRadius: 10, border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', padding: '12px 14px',
} as const

/**
 * RejectionSummary — the calm, READ-ONLY outcome card shown at the top of the
 * Sollicitatie tab once an application is rejected (Danny 25-07: the outcome
 * belongs on the first drill-down screen, the form itself moved to a footer
 * button + confirm modal, see RejectionModal). No pencil, no edit affordance —
 * there is no PATCH for an existing rejection and re-posting /reject would
 * re-notify the candidate (§3 no fake affordance), tracked as APP-REJECTION-EDIT-1
 * with CMBE. Renders nothing when the application carries no rejection.
 */
export default function RejectionSummary({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
  // An application can sit in the rejected bucket WITHOUT a rejection record — the
  // phase picker (and the seeder) can move it there without a reason, which is the
  // gap APP-REJECT-GUARD-1 closes server-side. Show that state honestly instead of
  // rendering nothing: an empty spot reads as "no data available", while this reads
  // as "rejected, but nobody recorded why" — which is exactly what happened.
  const isRejected = a.bucket === 'rejected'
  if (!a.rejection) {
    if (!isRejected) return null
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={16} color="var(--color-danger)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>{t('rejection.rejected')}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{t('rejection.noRecord')}</div>
      </div>
    )
  }

  const { reason_label: reasonLabel, note, channel, sent_at: sentAt } = a.rejection
  // An unknown/renamed tenant channel still shows its raw value via defaultValue,
  // instead of a missing-key string.
  const channelLabel = channel ? t(`rejection.channels.${channel}`, { defaultValue: channel }) : ''
  // Join only the parts that actually exist — never a dangling ' · ' separator.
  const metaParts = [
    sentAt ? t('rejection.sentOn', { date: formatDate(sentAt) }) : t('rejection.notSent'),
    channel ? t('rejection.viaChannel', { channel: channelLabel }) : '',
  ].filter(Boolean)

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <XCircle size={16} color="var(--color-danger)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>{t('rejection.rejected')}</span>
      </div>
      {reasonLabel && (
        <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6 }}>{reasonLabel}</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{metaParts.join(' · ')}</div>
      {note && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('rejection.note')}</div>
          <SafeHtml html={note} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
        </div>
      )}
    </div>
  )
}
