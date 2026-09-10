// MatchesBoard — kanban view of matches, one column per match status, with
// drag-and-drop between columns. See the fuller doc comment on the component below.
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import ScorePill from './ScorePill'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'
import { BoardCardShell, BoardColumnShell, BoardScrollArea, useBoardDrag } from '@/components/ui/board'

export interface BoardColumn { key: string; label: string; color: string }

// A single draggable match card.
function BoardCard({ match, onDragStart, onClick, selected }: {
  match: MatchRow; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onClick: (m: MatchRow) => void; selected: boolean
}) {
  return (
    <BoardCardShell onDragStart={e => onDragStart(e, match.id)} onClick={() => onClick(match)} selected={selected}
      ariaLabel={[match.candidateName, match.vacancy].filter(Boolean).map(String).join(' · ')}>

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
    </BoardCardShell>
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
    <BoardScrollArea scrollRef={boardScrollRef} onDragOver={boardAutoScroll}>
      {columns.map(column => {
        const items = rows.filter(r => inColumn(r, column))
        return (
          <BoardColumnShell key={column.key} label={column.label} color={column.color} showDot
            onDrop={e => handleDrop(e, column.key)} onDragOver={handleDragOver}
            items={items} emptyText={t('board.empty')}
            renderItem={match => (
              <BoardCard key={match.id} match={match} onDragStart={handleDragStart}
                onClick={onSelect} selected={match.id === selectedId} />
            )} />
        )
      })}
    </BoardScrollArea>
  )
}
