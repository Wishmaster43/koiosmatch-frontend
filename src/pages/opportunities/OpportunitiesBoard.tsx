// OpportunitiesBoard — kanban view, one column per deal stage. Presentational:
// the page owns the data and the stage mutation (onMove); drag-and-drop wiring
// and edge-auto-scroll live here, mirroring ApplicationsBoard's own idiom.
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import { useTranslation } from 'react-i18next'
import type { DragEvent } from 'react'
import Avatar, { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'
import { opportunityValueOf, formatOpportunityValue } from './data/opportunityValue'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { BoardCardShell, BoardColumnShell, BoardStateMessage, useBoardDrag } from '@/components/ui/board'

interface StageCol { value: string | number; label: string; color?: string }

// A single draggable opportunity card.
function BoardCard({ opp, onDragStart, onClick, selected }: {
  opp: Opportunity; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (o: Opportunity) => void; selected: boolean
}) {
  const { t } = useTranslation()
  // Tenant currency + app locale for the card value (I18N-1 L5).
  const { currency, locale } = useNumberFormat()
  // House date formatter (DATUM-1) — never a raw ISO string field.
  const { formatDate } = useDateFormat()
  return (
    <BoardCardShell onDragStart={e => onDragStart(e, opp.id)} onClick={() => onClick(opp)} selected={selected}
      ariaLabel={[opp.title, opp.client].filter(Boolean).join(' · ')}>

      {/* Title + client */}
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{opp.title || '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{opp.client || '—'}</div>

      {/* Value — the SAME shared hours-vs-euro cell as the table and the customer
          drawer tab (X-5-UNIT-PER-ROW): per-row unit from dealType.unit. */}
      {opportunityValueOf(opp) != null && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)', marginBottom: 8 }}>
          {formatOpportunityValue(opp, t, currency, locale)}
        </div>
      )}

      {/* Footer: owner avatar + date — the mapper only ever emits `owner`/`date`,
          so the avatar derives its initials from the owner name (mirrors the
          shared OpportunitiesTable cell) and the date renders via the house
          formatter instead of a raw API field. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Avatar initials={initialsOf(opp.owner)} size={18} color={NEUTRAL_AVATAR} soft />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opp.date ? formatDate(opp.date) : ''}</span>
      </div>
    </BoardCardShell>
  )
}

// A single stage column.
function BoardColumn({ stage, items, onDragStart, onDrop, onDragOver, onSelect, selectedId }: {
  stage: StageCol; items: Opportunity[]
  onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onDrop: (e: DragEvent<HTMLDivElement>, stageValue: string | number) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onSelect: (o: Opportunity) => void
  selectedId?: Id | null
}) {
  // LOOKUP-I18N-1: the seeded stage label renders in the user's language; the
  // column's own drop/grouping logic still keys on `stage.value`/`.label` raw.
  const seedLabel = useSeedLabel()
  const { t } = useTranslation('opportunities')
  return (
    // HUISSTIJL-1: the shared BoardColumnShell owns the header identity
    // (SectionTitle + §4-tinted count pill) and the dashed empty-state box —
    // no more hand-rolled fontSize/fontWeight heading here.
    <BoardColumnShell label={seedLabel('opportunityStages', { value: String(stage.value), label: stage.label })}
      color={stage.color} showDot onDrop={e => onDrop(e, stage.value)} onDragOver={onDragOver}
      items={items} emptyText={t('board.empty')}
      renderItem={o => (
        <BoardCard key={o.id} opp={o} selected={o.id === selectedId}
          onDragStart={onDragStart} onClick={onSelect} />
      )} />
  )
}

// OpportunitiesBoard — Kanban board grouped by stage; supports drag-and-drop to move.
// F3-idiom (mirrors ApplicationsBoard): reports its own loading/error/empty state
// honestly instead of showing zero-count columns while data is missing.
export default function OpportunitiesBoard({ rows, stages, onMove, selectedId, onSelect, loading, error }: {
  rows: Opportunity[]; stages: StageCol[]; onMove: (id: Id, stageValue: string | number) => void; selectedId?: Id | null; onSelect: (o: Opportunity) => void
  loading?: boolean; error?: unknown
}) {
  const { t } = useTranslation('opportunities')
  // Drag-and-drop wiring: ref for auto-scroll, handlers for start/over/drop, dragId ref.
  const { boardScrollRef, boardAutoScroll, handleDragStart, handleDragOver, handleDrop } = useBoardDrag<HTMLDivElement, string | number>({ onMove })

  // Honest four-state board: a fetch failure or the first-paint load must never
  // look like "zero opportunities everywhere" — show the same calm, centred
  // message the table shows instead of silently rendering every stage at count 0.
  if (loading || error || rows.length === 0) {
    // CLONE-BY-CONSTRUCTION-1: the shared BoardStateMessage atom, not a
    // hand-copied version of the identical block in ApplicationsBoard.
    return <BoardStateMessage message={loading ? t('loading') : error ? t('error') : t('empty')} />
  }

  return (
    <div ref={boardScrollRef} onDragOver={boardAutoScroll} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '0 20px 20px',
      display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {stages.map(s => (
        // LOOKUP-I18N-1: match on the raw stageValue only — r.stage may be a
        // translated (or stale-locale) label and must never drive grouping.
        <BoardColumn key={s.value} stage={s}
          items={rows.filter(r => r.stageValue === s.value)}
          onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
          onSelect={onSelect} selectedId={selectedId} />
      ))}
    </div>
  )
}
