import type { ReactNode } from 'react'

/**
 * SoftChip — the §3A soft-chip convention: a tinted label with a matching border
 * and never a solid fill. Background = color+1A, text = color, border = color+55.
 *
 * Use this for coloured lookup chips (status/type/priority/…) so every entity
 * reads the same. (StatusPill is the older pill style; prefer SoftChip for new
 * lists to stay on-convention.)
 */
interface SoftChipProps {
  label?: ReactNode
  color?: string | null
  /** Optional leading dot (e.g. a priority indicator). */
  dot?: boolean
  title?: string
}

export default function SoftChip({ label, color, dot = false, title }: SoftChipProps) {
  const c = color ?? '#9CA3AF'
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
      background: c + '1A', color: c, border: `1px solid ${c}55`, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />}
      {label}
    </span>
  )
}
