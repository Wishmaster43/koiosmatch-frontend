/**
 * BoardCardShell — the draggable card wrapper (surface/radius/padding, cursor
 * grab, the selected-border highlight, activatableCardProps for keyboard
 * operability) shared by ApplicationsBoard, MatchesBoard and OpportunitiesBoard
 * (DRY round 11, PAGES). Each board keeps its own card body as children; the
 * accessible name travels in as `ariaLabel` since it differs per entity.
 */
import type { DragEvent, ReactNode } from 'react'
import { activatableCardProps } from '@/components/ui/activatableCard'

export interface BoardCardShellProps {
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onClick: () => void
  selected: boolean
  ariaLabel: string
  children: ReactNode
}

export default function BoardCardShell({ onDragStart, onClick, selected, ariaLabel, children }: BoardCardShellProps) {
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      {...activatableCardProps(onClick, ariaLabel)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>
      {children}
    </div>
  )
}
