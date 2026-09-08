/**
 * InfoRow — shared label/value line for the SM report detail drawers
 * (DepartmentDrawer/LocationDrawer/CustomerDetailDrawer): renders nothing when
 * `value` is empty, so an absent field never leaves a blank row. Two variants
 * cover the two existing looks: `variant="block"` (default) is the bordered
 * details-list row with a fixed 130px label column; `variant="inline"` is the
 * compact "label: value" line used inline in a drawer header. When href is given,
 * the value renders as a clickable link (mailto/tel).
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Button from '@/components/ui/Button'

// Renders one icon+label+value line, or nothing when the value is falsy.
export default function InfoRow({
  icon: Icon,
  label,
  value,
  variant = 'block',
  href,
}: {
  icon: LucideIcon
  label: ReactNode
  value?: ReactNode
  variant?: 'block' | 'inline'
  href?: string | null
}) {
  if (!value) return null
  const valueNode = href ? (
    <Button
      variant="ghost"
      href={href}
      style={{
        fontSize: 12,
        color: 'var(--color-secondary)',
        whiteSpace: 'normal',
        wordBreak: 'break-all',
        height: 'auto',
        padding: 0,
        justifyContent: 'flex-start',
        textAlign: 'left',
      }}
    >
      {value}
    </Button>
  ) : (
    <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
  )

  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
        <Icon size={12} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}:</span>
        {valueNode}
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--hover-bg)',
      }}
    >
      <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      {valueNode}
    </div>
  )
}
