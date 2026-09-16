/**
 * BoardStateMessage — the centred loading/error/empty message every kanban
 * board renders instead of its columns when its own fetch has not produced
 * usable rows yet (§16 CLONE-BY-CONSTRUCTION-1: ApplicationsBoard and
 * MatchesBoard had grown byte-identical copies of this block independently).
 */
export interface BoardStateMessageProps {
  message: string
}

export default function BoardStateMessage({ message }: BoardStateMessageProps) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>
      {message}
    </div>
  )
}
