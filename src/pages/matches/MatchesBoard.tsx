import { useRef } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

export interface BoardColumn { key: string; label: string; color: string }

// A single draggable match card.
function BoardCard({ match, onDragStart, onClick, selected }: {
  match: MatchRow; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onClick: (m: MatchRow) => void; selected: boolean
}) {
  return (
    <div draggable onDragStart={e => onDragStart(e, match.id)} onClick={() => onClick(match)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>

      {/* Candidate (avatar + name) + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Avatar initials={match.initials} size={22} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>{match.candidate}</span>
        <ScorePill value={match.score} />
      </div>

      {/* Vacancy (single-line clamp) */}
      {match.vacancy && match.vacancy !== '—' && (
        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {match.vacancy}
        </div>
      )}

      {/* Footer: client + owner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.client !== '—' ? match.client : ''}</span>
        {match.owner && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{match.owner}</span>}
      </div>
    </div>
  )
}

// A single stage column with its cards.
function BoardColumnView({ column, items, onDragStart, onDrop, onDragOver, onSelect, selectedId, emptyText }: {
  column: BoardColumn; items: MatchRow[]
  onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onDrop: (e: DragEvent<HTMLDivElement>, stageKey: string) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onSelect: (m: MatchRow) => void
  selectedId?: Id | null
  emptyText: ReactNode
}) {
  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, column.key)} onDragOver={onDragOver}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: column.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{column.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
          background: column.color + '20', color: column.color }}>{items.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 80, borderRadius: 10,
        border: items.length === 0 ? '1px dashed var(--border)' : 'none' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{emptyText}</div>
        ) : items.map(match => (
          <BoardCard key={match.id} match={match} onDragStart={onDragStart}
            onClick={onSelect} selected={match.id === selectedId} />
        ))}
      </div>
    </div>
  )
}

/**
 * MatchesBoard — kanban view, one column per funnel STAGE. Presentational: the
 * page owns the data and the stage mutation (onMove). Dragging a card to another
 * column changes its stage (Danny's decision 2026-07-01). Mirrors TasksBoard.
 */
export default function MatchesBoard({ rows, columns, onMove, onSelect, selectedId }: {
  rows: MatchRow[]; columns: BoardColumn[]; onMove: (id: Id, stageKey: string) => void
  onSelect: (m: MatchRow) => void; selectedId?: Id | null
}) {
  const { t } = useTranslation('matches')
  const dragId = useRef<Id | null>(null)

  // A match's stage may arrive as the funnel value or its label — match either.
  const norm = (s?: string) => String(s ?? '').trim().toLowerCase()
  const inColumn = (r: MatchRow, c: BoardColumn) => norm(r.stage) === norm(c.key) || norm(r.stage) === norm(c.label)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: Id | undefined) => { dragId.current = id ?? null; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault()
    if (dragId.current != null) { onMove(dragId.current, stageKey); dragId.current = null }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {columns.map(column => (
          <BoardColumnView key={column.key} column={column}
            items={rows.filter(r => inColumn(r, column))}
            onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
            onSelect={onSelect} selectedId={selectedId} emptyText={t('board.empty')} />
        ))}
      </div>
    </div>
  )
}
