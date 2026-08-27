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
import { useNumberFormat } from '@/lib/formatters'
import MiniDonutJs from '../charts/MiniDonut'

type AnyProps = Record<string, unknown>
// MiniDonut is still untyped JS — accept any props at the boundary.
const MiniDonut = MiniDonutJs as unknown as ComponentType<AnyProps>

interface DonutChannel { label: string; value: ReactNode; color: string }
// `picked` = the active filter's display label; the card then shows a visible
// "label ✕"-chip and the donut dims the other segments — filtering on the biggest
// segment previously LOOKED dead (rows already matched; Danny's "58% toont niks").
export interface DonutSpec { key: string; title?: ReactNode; data: unknown[]; colors?: string[]; onPick?: (d: unknown) => void; active?: boolean; onClear?: () => void; picked?: string | null }
export interface KpiSpec { key: string; label?: ReactNode; value?: number | string; sub?: ReactNode; color?: string; onClick?: () => void; active?: boolean; channels?: DonutChannel[]; render?: ReactNode }

const CARD: CSSProperties = {
  flex: '1 1 0', minWidth: 0, height: 96, boxSizing: 'border-box',
  border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
  background: 'var(--surface)', display: 'flex', flexDirection: 'column',
}
const TITLE: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
// Nine cards on one row leave roughly 110px per label, which turned real labels
// into "TOTAAL MA…" / "BEËINDIGIN…". `wrapLabels` lets the title use two lines
// instead (the same thing the dashboard's own cards do) — opt-in, so the entity
// list pages with five or six wider cards keep their single-line strip.
// `overflowWrap: 'anywhere'` matters as much as the wrap itself: Dutch labels are
// long single words ("Beëindigingspercentage"), and a word with no break point
// cannot use a second line — it would still ellipsise on line one.
const TITLE_WRAP: CSSProperties = {
  ...TITLE, whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical', lineHeight: 1.25, overflowWrap: 'anywhere',
}

function DonutCard({ title, data, colors, onPick, active, onClear, picked, clearTitle }: Omit<DonutSpec, 'key'> & { clearTitle?: string }) {
  // Total moves to the title line ("STATUS · 99.968") — a 6-digit total never
  // fits the donut hole, so the ring stays clean at any tenant size (Danny 13/7).
  const { formatNumber } = useNumberFormat()
  const total = (data as Array<{ value?: number }>).reduce((s, d) => s + (d.value ?? 0), 0)
  return (
    <div style={{ ...CARD, position: 'relative', borderColor: active ? 'var(--color-primary)' : 'var(--border)' }}>
      {/* Title left, total right-aligned and ALWAYS visible (Danny 13/7); the
          active-filter chip lives bottom-right so it never covers the total. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ ...TITLE, minWidth: 0 }}>{title}</div>
        {data.length > 0 && (
          <span style={{ ...TITLE, color: 'var(--text)', flexShrink: 0 }}>{formatNumber(total)}</span>
        )}
      </div>
      {/* Active filter: icon-only clear button (Danny 13/7 — no text at filters);
          the picked value lives in the tooltip, the dimmed segments show the pick.
          HUISSTIJL-1 (Opus-F residual triage, judged): this button IS the active
          filter's own ON-state — same category as a selected pill/tab — so it
          reads the house trio (solid at rest), no more hover-driven colour swap.
          --button-ink is already the theme's contrast-safe ink for --button-fill
          (Button.tsx's clampedOnAccent), so the old AENF-yellow readability bug
          this hover logic guarded against cannot recur — there is no second
          colour to restore once the button is static. */}
      {active && onClear && (
        <button onClick={onClear} title={picked ? `${picked} — ${clearTitle ?? ''}` : clearTitle}
          aria-label={picked ? `${picked} — ${clearTitle ?? ''}` : clearTitle}
          style={{ position: 'absolute', bottom: 5, right: 6, width: 22, height: 22, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: 'var(--button-fill)', color: 'var(--button-ink)', border: 'none', zIndex: 1 }}>
          <FilterX size={12} />
        </button>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {data.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          : <MiniDonut data={data} colors={colors} size={62} showCenter={false} onItemClick={(d: unknown) => onPick?.(d)} pickedKey={active ? picked : null} />}
      </div>
    </div>
  )
}


// One equal-footprint KPI tile: a big number (or a custom render override), optional sub-label or per-channel mini-legend, and an active/tinted state when it doubles as a click-to-filter toggle.
function KpiCard({ label, value, sub, color, onClick, active, channels, render, wrapLabel }: Omit<KpiSpec, 'key'> & { wrapLabel?: boolean }) {
  const clickable = typeof onClick === 'function'
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  // HUISSTIJL-1 (Opus-F residual triage, judged — LEFT tinted below, not trio):
  // unlike the donut's own clear button above, this card's big VALUE number
  // carries its own semantic `color` (danger/warning/info/teal-tasks — a DATA
  // colour, the law's own carve-out). A solid tenant-primary fill behind that
  // data-coloured number would clash and read worse, and no other KpiCard in
  // the app goes solid-on-active — the calm tint + the primary border already
  // say "selected" without fighting the number's own colour.
  return (
    <div {...interactive(onClick)} title={typeof sub === 'string' ? sub : undefined}
      style={{ ...CARD,
        background: active ? 'var(--color-primary-bg)' : 'var(--surface)',
        borderColor: active ? 'var(--color-primary)' : 'var(--border)',
        cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.12s, background 0.12s' }}
      onMouseEnter={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--color-primary-light)' } : undefined}
      onMouseLeave={clickable ? e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' } : undefined}>
      {/* The full label is always the accessible title too, so a two-line clamp
          never hides what the number counts. */}
      <div style={wrapLabel ? TITLE_WRAP : TITLE} title={typeof label === 'string' ? label : undefined}>{label}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        {/* Custom card body (e.g. a mini stacked bar) overrides the value/channels. */}
        {render ?? <>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: color || 'var(--text)' }}>
          {typeof value === 'number' ? formatNumber(value) : value}
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
        </>}
      </div>
    </div>
  )
}

// Config-driven insights strip (§3A): equal-footprint donut + KPI cards, click-to-filter, with an optional data-honesty notice when server-wide stats fell back to page-scope counts (STATS-OOM-1).
export default function InsightsRow({ donuts = [], kpis = [], padding = '16px 24px 12px', clearTitle, notice, wrapLabels = false }: {
  donuts?: DonutSpec[]; kpis?: KpiSpec[]; padding?: string; clearTitle?: string
  // Two-line card titles instead of one ellipsised line — see TITLE_WRAP. Used by
  // the reports' nine-card band (ReportKpiBand), where labels no longer fit.
  wrapLabels?: boolean
  // Data-honesty notice (STATS-OOM-1): shown when the server-wide stats failed and
  // the cards silently fall back to page-scope counts — never present fallback
  // numbers as true totals without saying so.
  notice?: string
}) {
  return (
    <>
    {notice && (
      <div role="status" style={{ margin: '10px 24px -6px', padding: '5px 10px', fontSize: 11, borderRadius: 7,
        color: 'var(--color-warning-text)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', width: 'fit-content' }}>
        {notice}
      </div>
    )}
    <div style={{ padding, display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
      {donuts.map(({ key, ...d }) => <DonutCard key={key} {...d} clearTitle={clearTitle} />)}
      {kpis.map(({ key, ...k }) => <KpiCard key={key} {...k} wrapLabel={wrapLabels} />)}
    </div>
    </>
  )
}
