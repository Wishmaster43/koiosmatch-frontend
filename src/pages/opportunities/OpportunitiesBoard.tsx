// OpportunitiesBoard — kanban view, one column per deal stage. Presentational:
// the page owns the data and the stage mutation (onMove); drag-and-drop wiring
// and edge-auto-scroll live here, mirroring ApplicationsBoard's own idiom.
import { useNumberFormat } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import type { DragEvent } from 'react'
import Avatar from '@/components/ui/Avatar'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'
import { opportunityValueOf, formatOpportunityValue } from './data/opportunityValue'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { BoardCardShell, useBoardDrag } from '@/components/ui/board'

interface StageCol { value: string | number; label: string; color?: string }

// A single draggable opportunity card.
function BoardCard({ opp, onDragStart, onClick, selected }: {
  opp: Opportunity; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (o: Opportunity) => void; selected: boolean
}) {
  // ownerInitials/ownerColor/created are carried on the mapped row (not on the base type).
  const { t } = useTranslation()
  // Tenant currency + app locale for the card value (I18N-1 L5).
  const { currency, locale } = useNumberFormat()
  const o = opp as Opportunity & { ownerInitials?: string; ownerColor?: string | null; created?: string }
  return (
    <BoardCardShell onDragStart={e => onDragStart(e, opp.id)} onClick={() => onClick(opp)} selected={selected}
      ariaLabel={[opp.title, opp.client].filter(Boolean).join(' · ')}>

      {/* Title + client */}
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{opp.title || '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{opp.client || '—'}</div>

      {/* Value — the SAME shared hours-vs-euro cell as the table and the customer
          drawer tab (X-5-UNIT-PER-ROW): per-row unit from dealType.unit. */}
      {opportunityValueOf(o) != null && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)', marginBottom: 8 }}>
          {formatOpportunityValue(o, t, currency, locale)}
        </div>
      )}

      {/* Footer: owner avatar + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Avatar initials={o.ownerInitials} size={18} color={o.ownerColor} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.created}</span>
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
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, stage.value)} onDragOver={onDragOver}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `2px solid ${stage.color}`, marginBottom: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', flex: 1 }}>{seedLabel('opportunityStages', { value: String(stage.value), label: stage.label })}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{items.length}</span>
      </div>
      {items.map(o => (
        <BoardCard key={o.id} opp={o} selected={o.id === selectedId}
          onDragStart={onDragStart} onClick={onSelect} />
      ))}
    </div>
  )
}

// OpportunitiesBoard — Kanban board grouped by stage; supports drag-and-drop to move.
export default function OpportunitiesBoard({ rows, stages, onMove, selectedId, onSelect }: {
  rows: Opportunity[]; stages: StageCol[]; onMove: (id: Id, stageValue: string | number) => void; selectedId?: Id | null; onSelect: (o: Opportunity) => void
}) {
  // Drag-and-drop wiring: ref for auto-scroll, handlers for start/over/drop, dragId ref.
  const { boardScrollRef, boardAutoScroll, handleDragStart, handleDragOver, handleDrop } = useBoardDrag<HTMLDivElement, string | number>({ onMove })

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
