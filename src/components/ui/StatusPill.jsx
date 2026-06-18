/**
 * StatusPill — small rounded status label tinted with an explicit colour.
 *
 * Used by the candidate list + drawer, which carry a resolved `statusColor` from
 * the mapper. (For status maps keyed by name, use the shared StatusBadge instead.)
 */
export default function StatusPill({ label, color }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
      background: (color ?? '#9CA3AF') + '20', color: color ?? '#9CA3AF' }}>
      {label}
    </span>
  )
}
