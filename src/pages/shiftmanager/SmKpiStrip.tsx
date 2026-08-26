/**
 * SmKpiStrip — shared KPI-card strip for the Shiftmanager list pages
 * (DepartmentsPage/LocationsPage, "27 identical lines" consolidation): one
 * equal-flex row of icon+value+label cards, config-driven so each page only
 * supplies its own `kpis` array.
 */
import type { ComponentType, CSSProperties } from 'react'
import { Caption } from '@/components/ui/typography'

// One KPI card's config: label/value plus the icon tile's colour and icon.
export interface SmKpiCard {
  label: string
  value: number | string
  color: string
  bg: string
  Icon: ComponentType<{ size?: number; color?: string }>
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }

// Renders one equal-flex KPI card per entry: an icon tile, the big value and its label.
export default function SmKpiStrip({ kpis }: { kpis: SmKpiCard[] }) {
  return (
    <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 20, flexShrink: 0 }}>
      {kpis.map(k => (
        <div key={k.label} style={CARD}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: k.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <k.Icon size={15} color={k.color} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.value}</div>
            <Caption as="div" style={{ marginTop: 2 }}>{k.label}</Caption>
          </div>
        </div>
      ))}
    </div>
  )
}
