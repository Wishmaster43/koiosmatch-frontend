/**
 * RoleChip — a role shown as a coloured soft-chip with its icon (§4 soft-tint via
 * lib/tint's house pair; ink via chipInk — the raw colour on its own tint reads
 * 2.4-3.0:1, herhaal-slotaudit r3.5). One component for every place a role
 * appears: the roles list, the user list and role filters. Colour + icon come
 * from the role record (backend); both fall back sensibly.
 */
import { roleIconEl } from '@/lib/roleIcons'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

interface RoleChipProps {
  name: string
  color?: string | null
  icon?: string | null
  size?: number
  title?: string
}

export default function RoleChip({ name, color, icon, size = 12, title }: RoleChipProps) {
  // lib/tint (not hex+alpha concat) so both hex data-colours and var(--color-*) tokens work.
  const c = color || 'var(--text-muted)'
  return (
    <span title={title ?? name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
      background: tintBg(c), color: chipInk(c),
      border: tintBorder(c), whiteSpace: 'nowrap' }}>
      {roleIconEl(icon, { size })}
      {name}
    </span>
  )
}
