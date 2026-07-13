/**
 * OverviewTab — the match facts (read-only summary card) plus, beneath it, the
 * EDITABLE placement/contract layer (MatchContractSection). The summary itself
 * stays read-only — a match is the continuation of an application → placement
 * (§3B) and those facts are derived — but the contract/financial fields ARE the
 * placement, so they're editable in-place here (mirrors the candidate drawer's
 * EditableFieldTable pattern).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from '../ScorePill'
import SelectMenu from '@/components/ui/SelectMenu'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import MatchContractSection from './MatchContractSection'
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

interface OverviewTabProps {
  match: MatchRow
  onSetStatus?: (status: string) => void
  // Bubbles a contract-save's approval_status echo back to the page (§ header badge).
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

export default function OverviewTab({ match, onSetStatus, onUpdate }: OverviewTabProps) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()
  // Lifecycle status from the tenant lookup — the is_closed FLAG ends the match (R-1b).
  const { statuses, metaOf } = useMatchStatuses()
  const statusMeta = metaOf(match.status)

  return (
    <div>
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
          {/* Lifecycle status — editable from the tenant lookup; closing statuses end the match. */}
          <Field label={t('drawer.fields.status')}>
            {onSetStatus ? (
              <SelectMenu value={match.status || null} onChange={onSetStatus}
                placeholder={t('drawer.fields.status')}
                options={statuses.map(o => ({ value: o.value, label: o.label }))} />
            ) : statusMeta ? (
              <StatusPill label={statusMeta.label} color={statusMeta.color} />
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </Field>
          <Field label={t('drawer.fields.created')}>{formatDate(match.date)}</Field>
        </div>
      </div>
      {/* Editable placement/contract layer — sibling section beneath the read-only
          summary card (§3A: extend, don't nest inside the summary's own border). */}
      <MatchContractSection matchId={match.id} onUpdate={onUpdate} />
    </div>
  )
}
