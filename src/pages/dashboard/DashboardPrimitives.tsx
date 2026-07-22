/**
 * DashboardPrimitives — small presentational building blocks shared across the
 * dashboard container and its extracted block components (KPI tile, chart panel
 * wrapper, titled list block, avatar, status badge). Extracted from Dashboard.tsx
 * (§0.3 size split); rendering identical to the original inline components.
 */
import type { ReactNode } from 'react'
import { interactive } from '@/lib/a11y'
import type { LucideIcon } from 'lucide-react'

export function KpiCard({ label, value, sub, color, bg, Icon, onClick }: {
  label?: ReactNode; value?: ReactNode; sub?: ReactNode; color?: string; bg?: string; Icon: LucideIcon; onClick?: () => void
}) {
  return (
    <div {...interactive(onClick)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// Themed container that hosts a (theme-agnostic) chart card.
export function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  )
}

export function Block({ title, action, onAction, children }: { title?: ReactNode; action?: ReactNode; onAction?: () => void; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {action && <span {...interactive(onAction)} style={{ fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer' }}>{action} →</span>}
      </div>
      {children}
    </div>
  )
}

export function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  const colors = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

export function StatusBadge({ label, color }: { label?: ReactNode; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99,
    background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>
}
