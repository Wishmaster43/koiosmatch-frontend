/**
 * DrawerFieldRow — one label/value row in a detail drawer's field list (an
 * optional leading icon, a fixed-width muted label, the value). MessageDrawer
 * built the same row twice by hand (recipient rows with an icon, timeline rows
 * without) — extracted so the row's spacing/typography lives once (DRY round).
 */
import type { ComponentType } from 'react'

export function DrawerFieldRow({ icon: Icon, label, value, labelWidth = 120 }: {
  icon?: ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
  label: string
  value: React.ReactNode
  labelWidth?: number
}) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      {Icon && <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
