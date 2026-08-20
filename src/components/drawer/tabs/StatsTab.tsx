/**
 * StatsTab — generic statistics tab: a KPI grid + an optional key/value overview
 * card + an optional recent-activity card. Entity-agnostic; everything via props.
 */
import type { ComponentType, ReactNode } from 'react'
import SectionCard from '@/components/ui/SectionCard'
import DetailTableJs from '@/components/ui/DetailTable'
import { Caption, GroupLabel } from '@/components/ui/typography'

type AnyProps = Record<string, unknown>
// DetailTable is still untyped JS — accept any props at the boundary.
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

interface Kpi { label: string; value: ReactNode; sub?: ReactNode; color?: string; onClick?: () => void }
interface Overview { title?: ReactNode; rows?: Array<[ReactNode, ReactNode]> }
interface ActivityItem { text?: ReactNode; time?: ReactNode }
interface Activity { title?: ReactNode; items: ActivityItem[]; emptyText?: ReactNode }

export default function StatsTab({ kpis = [], kpisTitle, overview, activity }: { kpis?: Kpi[]; kpisTitle?: ReactNode; overview?: Overview; activity?: Activity }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI grid with its own grey section heading (kept outside the cards). */}
      <div>
        {kpisTitle && <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>{kpisTitle}</GroupLabel>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} onClick={k.onClick} role={k.onClick ? 'button' : undefined} tabIndex={k.onClick ? 0 : undefined}
            onKeyDown={k.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') k.onClick?.() } : undefined}
            style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)', cursor: k.onClick ? 'pointer' : 'default' }}>
            {/* Herhaal-audit r4 finding 11: the shared Caption atom (11/text-muted). */}
            <Caption as="div" style={{ marginBottom: 8 }}>{k.label}</Caption>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
        </div>
      </div>

      {overview && (
        <SectionCard title={overview.title}>
          {/* Canon width (fieldRowCanon, 05-08): DetailTable's own default now matches. */}
          <DetailTable rows={overview.rows} />
        </SectionCard>
      )}

      {activity && (
        <SectionCard title={activity.title}>
          {activity.items.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activity.emptyText}</div>
            : activity.items.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  {/* Decorative timeline marker dot, not an action surface — the
                      accent-fill rule targets hand-painted BUTTON identity. */}
                  {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{ev.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ev.time}</div>
                  </div>
                </div>
              ))}
        </SectionCard>
      )}
    </div>
  )
}
