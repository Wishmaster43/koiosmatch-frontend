/**
 * OverviewTab — the match facts: a read-only summary card (candidate/vacancy/client/
 * score/stage/status). Stays read-only — a match is the continuation of an
 * application → placement (§3B) and those facts are derived. The editable
 * contract/financial layer used to live inline here; it is now its own drawer tab
 * (MatchContractSection, wired directly in MatchDrawer) and the candidate/vacancy/
 * client relations + their hyperlinks are the Relations tab (RelationsTab) — one
 * tab, one purpose (§3A blueprint: real tabs, not one tab wearing two hats).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from '../ScorePill'
import SelectMenu from '@/components/ui/SelectMenu'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
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
}

export default function OverviewTab({ match, onSetStatus }: OverviewTabProps) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()
  // Lifecycle status from the tenant lookup — the is_closed FLAG ends the match (R-1b).
  const { statuses, metaOf } = useMatchStatuses()
  const statusMeta = metaOf(match.status)

  return (
    // Danny 27-07 ("achtergrond kleur???"): this card was hand-rolled with
    // background --bg (the grey page tint) and its own bold title, so the match
    // drawer was the only one with a tinted panel. It now uses the shared
    // SectionCard — same border/radius, --surface background, grey uppercase
    // title outside the block — exactly like every other drawer.
    <SectionCard title={t('drawer.sectionDetails')}>
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
    </SectionCard>
  )
}
