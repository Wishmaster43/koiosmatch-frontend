/**
 * RoleChip — a role shown as a coloured soft-chip with its icon (§4 soft-tint via
 * color-mix: background ≈10%, text = color, border ≈33%). One component for every
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
  // color-mix (not hex+alpha concat) so both hex data-colours and var(--color-*) tokens work.
  const c = color || 'var(--text-muted)'
  return (
    <span title={title ?? name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
      background: `color-mix(in srgb, ${c} 10%, transparent)`, color: c,
      border: `1px solid color-mix(in srgb, ${c} 33%, transparent)`, whiteSpace: 'nowrap' }}>
      {roleIconEl(icon, { size })}
      {name}
    </span>
  )
}
