// MatchesBoard — kanban view of matches, one column per match status, with
// drag-and-drop between columns. See the fuller doc comment on the component below.
import type { DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'
import { activatableCardProps } from '@/components/ui/activatableCard'
import { BoardColumnHeader, useBoardDrag } from '@/components/ui/board'

export interface BoardColumn { key: string; label: string; color: string }

// A single draggable match card.
function BoardCard({ match, onDragStart, onClick, selected }: {
  match: MatchRow; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onClick: (m: MatchRow) => void; selected: boolean
}) {
  return (
    <div draggable onDragStart={e => onDragStart(e, match.id)} onClick={() => onClick(match)}
      {...activatableCardProps(() => onClick(match), [match.candidateName, match.vacancy].filter(Boolean).map(String).join(' · '))}
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
      <BoardColumnHeader label={column.label} count={items.length} color={column.color} showDot />
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
 * MatchesBoard — kanban view, one column per match STATUS (R-1b lookup; the old
 * funnel-stage columns emptied out when the resource moved to `status`).
 * Presentational: the page owns the data and the status mutation (onMove).
 */
export default function MatchesBoard({ rows, columns, onMove, onSelect, selectedId }: {
  rows: MatchRow[]; columns: BoardColumn[]; onMove: (id: Id, stageKey: string) => void
  onSelect: (m: MatchRow) => void; selectedId?: Id | null
}) {
  const { t } = useTranslation('matches')
  // Drag-and-drop wiring: ref for auto-scroll, handlers for start/over/drop, dragId ref.
  const { boardScrollRef, boardAutoScroll, handleDragStart, handleDragOver, handleDrop } = useBoardDrag<HTMLDivElement, string>({ onMove })

  // A match's status may arrive as the lookup value or its label — match either.
  const norm = (s?: string) => String(s ?? '').trim().toLowerCase()
  const inColumn = (r: MatchRow, c: BoardColumn) => norm(r.status) === norm(c.key) || norm(r.status) === norm(c.label)

  return (
    <div ref={boardScrollRef} onDragOver={boardAutoScroll} style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
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
