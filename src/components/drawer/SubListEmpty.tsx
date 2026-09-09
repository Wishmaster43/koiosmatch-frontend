/**
 * SubListEmpty — the shared empty state message for drawer sub-lists (12px muted).
 * Used by MatchesTab, ApplicantsTab, and related list bodies.
 */

interface SubListEmptyProps {
  /** The empty message text (localized by the caller). */
  text: string
}

export default function SubListEmpty({ text }: SubListEmptyProps) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      {text}
    </div>
  )
}
