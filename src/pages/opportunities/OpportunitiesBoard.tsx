import { useRef } from 'react'
import type { DragEvent } from 'react'
import Avatar from '@/components/ui/Avatar'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

interface StageCol { value: string | number; label: string; color?: string }

// A single draggable opportunity card.
function BoardCard({ opp, onDragStart, onClick, selected }: {
  opp: Opportunity; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (o: Opportunity) => void; selected: boolean
}) {
  // ownerInitials/ownerColor/created are carried on the mapped row (not on the base type).
  const o = opp as Opportunity & { ownerInitials?: string; ownerColor?: string | null; created?: string }
  return (
    <div draggable onDragStart={e => onDragStart(e, opp.id)} onClick={() => onClick(opp)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>

      {/* Title + client */}
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{opp.title || '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{opp.client || '—'}</div>

      {/* Value */}
      {opp.value != null && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 8 }}>
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(opp.value)}
        </div>
      )}

      {/* Footer: owner avatar + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Avatar initials={o.ownerInitials} size={18} color={o.ownerColor} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.created}</span>
      </div>
    </div>
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
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, stage.value)} onDragOver={onDragOver}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `2px solid ${stage.color}`, marginBottom: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', flex: 1 }}>{stage.label}</span>
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
  const dragging = useRef<Id | null>(null)

  const onDragStart = (e: DragEvent<HTMLDivElement>, id: Id | undefined) => {
    dragging.current = id ?? null
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const onDrop = (e: DragEvent<HTMLDivElement>, stageValue: string | number) => {
    e.preventDefault()
    if (dragging.current != null) { onMove(dragging.current, stageValue); dragging.current = null }
  }

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '0 20px 20px',
      display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {stages.map(s => (
        <BoardColumn key={s.value} stage={s}
          items={rows.filter(r => r.stage === s.label || r.stageValue === s.value)}
          onDragStart={onDragStart} onDrop={onDrop} onDragOver={onDragOver}
          onSelect={onSelect} selectedId={selectedId} />
      ))}
    </div>
  )
}
