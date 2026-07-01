/**
 * OverviewTab — the (read-only) detail body of a match. A match is the
 * continuation of an application → placement (§3B), so nothing here is editable:
 * it only renders the match facts as a titled key/value card. Richer data
 * (placement dates, changelog, clickable candidate/vacancy links) waits on the
 * backend detail endpoint — see docs/DATA-API.md.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from '../ScorePill'
import type { MatchRow } from '@/types/match'

// One read-only field: label above, value below (§3B field layout).
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

// Render a plain text value, or an em dash when empty (never blank per §3 states).
function textOrDash(value: string): ReactNode {
  return value && value !== '—' ? value : <span style={{ color: 'var(--text-muted)' }}>—</span>
}

export default function OverviewTab({ match }: { match: MatchRow }) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg)' }}>
      {/* Titled card — grouped match facts */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        {t('drawer.sectionDetails')}
      </div>
      {/* Two-column grid; short fields pair up (§3B) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
        <Field label={t('drawer.fields.candidate')}>{textOrDash(match.candidate)}</Field>
        <Field label={t('drawer.fields.vacancy')}>{textOrDash(match.vacancy)}</Field>
        <Field label={t('drawer.fields.client')}>{textOrDash(match.client)}</Field>
        <Field label={t('drawer.fields.owner')}>{textOrDash(match.owner)}</Field>
        <Field label={t('drawer.fields.score')}><ScorePill value={match.score} /></Field>
        <Field label={t('drawer.fields.stage')}>
          {match.stage
            ? <StatusPill label={match.stage} color={match.stageColor} />
            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </Field>
        <Field label={t('drawer.fields.created')}>{formatDate(match.date)}</Field>
      </div>
    </div>
  )
}
