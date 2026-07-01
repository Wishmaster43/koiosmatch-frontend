/**
 * RoleChip — a role shown as a coloured soft-chip with its icon (§3A convention:
 * background = color+1A, text = color, border = color+55). One component for every
 * place a role appears: the roles list, the user list and role filters. Colour +
 * icon come from the role record (backend); both fall back sensibly.
 */
import { roleIconEl } from '@/lib/roleIcons'

interface RoleChipProps {
  name: string
  color?: string | null
  icon?: string | null
  size?: number
  title?: string
}

export default function RoleChip({ name, color, icon, size = 12, title }: RoleChipProps) {
  const c = color || '#6B7280'
  return (
    <span title={title ?? name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
      background: c + '1A', color: c, border: `1px solid ${c}55`, whiteSpace: 'nowrap' }}>
      {roleIconEl(icon, { size })}
      {name}
    </span>
  )
}
