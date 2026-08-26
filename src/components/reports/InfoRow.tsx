/**
 * InfoRow — shared label/value line for the SM report detail drawers
 * (DepartmentDrawer/LocationDrawer/CustomerDetailDrawer): renders nothing when
 * `value` is empty, so an absent field never leaves a blank row. Two variants
 * cover the two existing looks: `variant="block"` (default) is the bordered
 * details-list row with a fixed 130px label column; `variant="inline"` is the
 * compact "label: value" line used inline in a drawer header.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Renders one icon+label+value line, or nothing when the value is falsy.
export default function InfoRow({ icon: Icon, label, value, variant = 'block' }: {
  icon: LucideIcon
  label: ReactNode
  value?: ReactNode
  variant?: 'block' | 'inline'
}) {
  if (!value) return null
  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
        <Icon size={12} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}:</span>
        <span style={{ color: 'var(--text)' }}>{value}</span>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
