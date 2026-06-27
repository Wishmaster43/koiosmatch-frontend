/**
 * InsightsRow — one compact strip of equal-footprint cards: config-driven donuts
 * + KPI cards, all the same size so donuts and KPI numbers line up on a single
 * row. Shared by every entity list (candidates, applications, …).
 *
 * `clearTitle` is the tooltip on a donut's clear-filter button (pass a translated
 * string so the shared component stays free of hardcoded copy).
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { FilterX } from 'lucide-react'
import MiniDonutJs from '../charts/MiniDonut'

type AnyProps = Record<string, unknown>
// MiniDonut is still untyped JS — accept any props at the boundary.
const MiniDonut = MiniDonutJs as unknown as ComponentType<AnyProps>

interface DonutChannel { label: string; value: ReactNode; color: string }
export interface DonutSpec { key: string; title?: ReactNode; data: unknown[]; colors?: string[]; onPick?: (d: unknown) => void; active?: boolean; onClear?: () => void }
export interface KpiSpec { key: string; label?: ReactNode; value: number | string; sub?: ReactNode; color?: string; onClick?: () => void; active?: boolean; channels?: DonutChannel[] }

const CARD: CSSProperties = {
  flex: '1 1 0', minWidth: 0, height: 96, boxSizing: 'border-box',
  border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
  background: 'var(--surface)', display: 'flex', flexDirection: 'column',
}
const TITLE: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

function DonutCard({ title, data, colors, onPick, active, onClear, clearTitle }: Omit<DonutSpec, 'key'> & { clearTitle?: string }) {
  return (
    <div style={{ ...CARD, position: 'relative' }}>
      <div style={TITLE}>{title}</div>
      {active && onClear && (
        <button onClick={onClear} title={clearTitle}
          style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: 'none', padding: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}>
          <FilterX size={12} />
        </button>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {data.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          : <MiniDonut data={data} colors={colors} size={54} onItemClick={(d: unknown) => onPick?.(d)} />}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color, onClick, active, channels }: Omit<KpiSpec, 'key'>) {
  const clickable = typeof onClick === 'function'
  return (
    <div onClick={onClick} title={typeof sub === 'string' ? sub : undefined}
      style={{ ...CARD,
        background: active ? 'var(--color-primary-bg)' : 'var(--surface)',
        borderColor: active ? 'var(--color-primary)' : 'var(--border)',
        cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.12s, background 0.12s' }}
      onMouseEnter={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--color-primary-light)' } : undefined}
      onMouseLeave={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' } : undefined}>
      <div style={TITLE}>{label}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: color || 'var(--text)' }}>
          {typeof value === 'number' ? value.toLocaleString('nl-NL') : value}
        </div>
        {channels ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {channels.map(ch => (
              <span key={ch.label} title={ch.label}
                style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                {ch.value}
              </span>
            ))}
          </div>
        ) : sub ? (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        ) : null}
      </div>
    </div>
  )
}

export default function InsightsRow({ donuts = [], kpis = [], padding = '16px 24px 12px', clearTitle }: {
  donuts?: DonutSpec[]; kpis?: KpiSpec[]; padding?: string; clearTitle?: string
}) {
  return (
    <div style={{ padding, display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
      {donuts.map(({ key, ...d }) => <DonutCard key={key} {...d} clearTitle={clearTitle} />)}
      {kpis.map(({ key, ...k }) => <KpiCard key={key} {...k} />)}
    </div>
  )
}
