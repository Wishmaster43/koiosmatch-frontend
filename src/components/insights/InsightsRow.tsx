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
import { interactive } from '@/lib/a11y'
import MiniDonutJs, { DEFAULT_COLORS } from '../charts/MiniDonut'

type AnyProps = Record<string, unknown>
// MiniDonut is still untyped JS — accept any props at the boundary.
const MiniDonut = MiniDonutJs as unknown as ComponentType<AnyProps>

interface DonutChannel { label: string; value: ReactNode; color: string }
// `picked` = the active filter's display label; the card then shows a visible
// "label ✕"-chip and the donut dims the other segments — filtering on the biggest
// segment previously LOOKED dead (rows already matched; Danny's "58% toont niks").
export interface DonutSpec { key: string; title?: ReactNode; data: unknown[]; colors?: string[]; onPick?: (d: unknown) => void; active?: boolean; onClear?: () => void; picked?: string | null }
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

function DonutCard({ title, data, colors, onPick, active, onClear, picked, clearTitle }: Omit<DonutSpec, 'key'> & { clearTitle?: string }) {
  return (
    <div style={{ ...CARD, position: 'relative', borderColor: active ? 'var(--color-primary)' : 'var(--border)' }}>
      <div style={{ ...TITLE, paddingRight: active ? 64 : 0 }}>{title}</div>
      {/* Active filter: a VISIBLE "value ✕" chip (not just a tiny icon) — clicking clears. */}
      {active && onClear && (
        <button onClick={onClear} title={clearTitle}
          style={{ position: 'absolute', top: 5, right: 6, maxWidth: '70%', height: 20, borderRadius: 999,
            display: 'flex', alignItems: 'center', gap: 4, padding: '0 7px', cursor: 'pointer',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: 'none',
            fontSize: 10, fontWeight: 600 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}>
          {picked && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picked}</span>}
          <FilterX size={11} style={{ flexShrink: 0 }} />
        </button>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 0 }}>
        {data.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          : (
            <>
              <MiniDonut data={data} colors={colors} size={54} onItemClick={(d: unknown) => onPick?.(d)} pickedKey={active ? picked : null} />
              <DonutLegend data={data} colors={colors} onPick={onPick} picked={active ? picked : null} />
            </>
          )}
      </div>
    </div>
  )
}

// Clickable legend next to the ring — a 54px sector is a tiny click target (Danny:
// "kan er niet op klikken"); the labels ARE the click surface now. Colours follow
// the ring's palette-by-original-index; top 4 by value show, the rest fold into +n.
function DonutLegend({ data, colors, onPick, picked }: {
  data: unknown[]; colors?: string[]; onPick?: (d: unknown) => void; picked?: string | null
}) {
  const palette = colors ?? DEFAULT_COLORS
  const items = (data as Array<{ name?: string; key?: string; color?: string; value?: number }>)
    .map((d, i) => ({ ...d, fill: d.color || palette[i % palette.length] }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const shown = items.slice(0, 4)
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {shown.map(item => {
        const isPicked = picked != null && (item.key === picked || item.name === picked)
        const dimmed = picked != null && !isPicked
        return (
          <button key={String(item.key ?? item.name)} onClick={() => onPick?.(item)} title={`${item.name} · ${item.value}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 0, background: 'none', border: 'none',
              cursor: onPick ? 'pointer' : 'default', minWidth: 0, opacity: dimmed ? 0.35 : 1, textAlign: 'left' }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: item.fill, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 10, color: 'var(--text)', fontWeight: isPicked ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{item.value}</span>
          </button>
        )
      })}
      {items.length > 4 && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', paddingLeft: 12 }}>+{items.length - 4}</span>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color, onClick, active, channels }: Omit<KpiSpec, 'key'>) {
  const clickable = typeof onClick === 'function'
  return (
    <div {...interactive(onClick)} title={typeof sub === 'string' ? sub : undefined}
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
