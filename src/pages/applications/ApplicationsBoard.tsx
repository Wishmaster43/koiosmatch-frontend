import { useRef } from 'react'
import type { DragEvent } from 'react'
import Avatar from '@/components/ui/Avatar'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

export interface BoardPhase { key: string; label: string; color: string }

// Score as soft-coloured text (green ≥75, amber ≥50, red below).
const scoreColor = (v: number): string => (v >= 75 ? 'var(--color-success)' : v >= 50 ? 'var(--color-warning)' : 'var(--color-danger)')

// A single draggable application card.
function BoardCard({ app, onDragStart, onClick, selected }: {
  app: Application; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (app: Application) => void; selected: boolean
}) {
  return (
    <div draggable onDragStart={e => onDragStart(e, app.id)} onClick={() => onClick(app)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>

      {/* Header: avatar + name + new-dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Avatar initials={app.candidateInitials} size={28} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>{app.candidateName}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: app.isNew ? 'var(--color-danger)' : 'var(--border)' }} />
      </div>

      {/* Match score */}
      {app.score != null && (
        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: scoreColor(app.score) }}>{app.score}%</div>
      )}

      {/* Vacancy (2-line clamp) */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 6,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {app.vacancyTitle}
      </div>

      {/* AI task */}
      {app.task && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'var(--color-primary-bg)',
          borderRadius: 6, padding: '5px 8px', marginBottom: 8 }}>
          <KoiosAiMark size={16} />
          <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 500,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {app.task}
          </span>
        </div>
      )}

      {/* Footer: owner + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Avatar initials={app.owner?.initials} size={18} color={app.owner?.color} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.created}</span>
      </div>
    </div>
  )
}

// A single phase column with its cards.
function BoardColumn({ phase, items, onDragStart, onDrop, onDragOver, onSelect, selectedId }: {
  phase: BoardPhase; items: Application[]
  onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onDrop: (e: DragEvent<HTMLDivElement>, phaseKey: string) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onSelect: (app: Application) => void
  selectedId?: Id | null
}) {
  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, phase.key)} onDragOver={onDragOver}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{phase.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
          background: phase.color + '20', color: phase.color }}>{items.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 60 }}>
        {items.map(app => (
          <BoardCard key={app.id} app={app} onDragStart={onDragStart}
            onClick={onSelect} selected={app.id === selectedId} />
        ))}
      </div>
    </div>
  )
}

/**
 * ApplicationsBoard — kanban view, one column per funnel phase. Presentational:
 * the page owns the data and the phase mutation (onMove).
 */
export default function ApplicationsBoard({ rows, phases, onMove, onSelect, selectedId }: {
  rows: Application[]; phases: BoardPhase[]; onMove: (id: Id, phaseKey: string) => void; onSelect: (app: Application) => void; selectedId?: Id | null
}) {
  const dragId = useRef<Id | null>(null)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: Id | undefined) => { dragId.current = id ?? null; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e: DragEvent<HTMLDivElement>, phaseKey: string) => {
    e.preventDefault()
    if (dragId.current != null) { onMove(dragId.current, phaseKey); dragId.current = null }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {phases.map(phase => (
          <BoardColumn key={phase.key} phase={phase}
            items={rows.filter(r => r.phaseKey === phase.key)}
            onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
            onSelect={onSelect} selectedId={selectedId} />
        ))}
      </div>
    </div>
  )
}
