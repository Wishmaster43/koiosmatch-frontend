/**
 * OutputTree — Make-style bundle inspector: renders a step/module output as an
 * expandable field tree instead of a raw JSON blob. Root lists become
 * "Bundle 1..N", nested objects/arrays expand inline, and an optional search box
 * filters keys + values. The backend caps list keys at 100 rows and adds a
 * sibling `<key>_total`; that cap is surfaced as "x van y getoond".
 *
 * OUTPUT-TREE-TYPED-1: four extra options (`typed`/`counts`/`bundles`/the
 * expand-/collapse-all signals), every default OFF so every existing consumer
 * keeps its byte-identical render; the run-step inspector switches them on.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Caption, monoStyle } from '@/components/ui/typography'
import { classifyValue, fieldCount, isBundleArray } from './outputTreeTypes'
import OutputTreeGlyph from './OutputTreeGlyph'
import OutputTreeBundle from './OutputTreeBundle'

// Cap what we render client-side so a huge (already BE-capped) list stays snappy.
const MAX_ROWS = 100

// The typed-tree options, bundled into one prop so call sites thread one object, not five.
export type OutputTreeOptions = {
  typed?: boolean
  counts?: boolean
  bundles?: boolean
  expandSignal?: number
  collapseSignal?: number
}

// RUN-INSPECTOR-1: `fill` swaps the fixed 420px scroll area for flex:1/minHeight:0
// so the tree stretches to the panel's own height (default OFF — every existing
// consumer keeps its byte-identical fixed-height render).

// True when the value renders as an expandable branch (object/array with content).
const isBranch = (v: unknown): boolean =>
  v != null && typeof v === 'object' && Object.keys(v as object).length > 0

// Short, single-line preview for a primitive value.
function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v.length > 140 ? v.slice(0, 140) + '…' : v
  return String(v)
}

// Recursive match: does this value (or any nested key/value) contain the query?
function matches(value: unknown, label: string, q: string, depth = 0): boolean {
  if (!q) return true
  if (label.toLowerCase().includes(q)) return true
  if (value == null || typeof value !== 'object') return formatValue(value).toLowerCase().includes(q)
  if (depth > 6) return false
  return Object.entries(value as Record<string, unknown>)
    .slice(0, MAX_ROWS)
    .some(([k, v]) => matches(v, k, q, depth + 1))
}

// Object entries minus `<key>_total` companions (shown as a cap hint instead).
function visibleEntries(obj: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(obj).filter(([k]) =>
    !(k.endsWith('_total') && Array.isArray(obj[k.slice(0, -'_total'.length)])))
}

// One key:value leaf row. Exported so OutputTreeBundle can render its trailing position/total pair.
export function LeafRow({ label, value, depth, opts, t }: {
  label: string; value: unknown; depth: number; opts?: OutputTreeOptions; t?: TFunction
}) {
  // Typed mode: an "empty" value (null/''/[]/{}) reads as the italic translated word, never a blank dash.
  const empty = opts?.typed && t ? classifyValue(value) === 'empty' : false
  const str = empty ? t!('inspector.empty') : formatValue(value)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 4px', paddingLeft: 4 + depth * 14 }}>
      {opts?.typed && <OutputTreeGlyph value={value} />}
      <Caption style={{ ...monoStyle, flexShrink: 0, fontWeight: opts?.typed ? 600 : undefined,
                        color: opts?.typed ? 'var(--text)' : undefined }}>{label}:</Caption>
      <span title={typeof value === 'string' && value.length > 140 ? value : undefined}
        style={{ ...monoStyle, fontSize: 11, color: opts?.typed ? 'var(--text-muted)' : 'var(--text)', wordBreak: 'break-word',
                 fontStyle: empty || value == null ? 'italic' : 'normal' }}>
        {str}
      </span>
    </div>
  )
}

// An expandable branch (object or array) with its children rendered lazily.
function BranchNode({ label, value, depth, defaultOpen, hint, query, t, opts, bundleMeta, bundleTotal }: {
  label: string; value: object; depth: number; defaultOpen: boolean; hint?: string | null
  query: string; t: TFunction; opts?: OutputTreeOptions
  bundleMeta?: { n: number; total: number }; bundleTotal?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Expand-/collapse-all: only react to a CHANGE of the signal (REFS-IN-EFFECTS-1) —
  // a branch mounting with expandSignal/collapseSignal already set must not re-fire on mount.
  const seenExpand = useRef(opts?.expandSignal)
  const seenCollapse = useRef(opts?.collapseSignal)
  useEffect(() => {
    if (seenExpand.current === opts?.expandSignal) return
    seenExpand.current = opts?.expandSignal
    if (opts?.expandSignal !== undefined) setOpen(true)
  }, [opts?.expandSignal])
  useEffect(() => {
    if (seenCollapse.current === opts?.collapseSignal) return
    seenCollapse.current = opts?.collapseSignal
    if (opts?.collapseSignal !== undefined) setOpen(false)
  }, [opts?.collapseSignal])
  // While searching, force branches open so hits are visible without clicking.
  const isOpen = query ? true : open
  const isArr = Array.isArray(value)
  const count = isArr ? (value as unknown[]).length : Object.keys(value).length
  const autoHint = opts?.counts ? t('inspector.fieldCount', { count }) : (isArr ? t('tree.items', { n: count }) : '')

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- TREE branch row: compact expandable list row (17px rhythm with its LeafRow siblings, hover as the affordance), a face Button deliberately does not model
        style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '3px 4px',
                 paddingLeft: 4 + depth * 14, background: 'none', border: 'none', cursor: 'pointer',
                 textAlign: 'left', borderRadius: 6 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        <ChevronRight size={11} color="var(--text-muted)"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }} />
        {opts?.typed && <OutputTreeGlyph type={classifyValue(value)} />}
        <span style={{ ...monoStyle, fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint ?? autoHint}</span>
      </button>
      {isOpen && (
        <>
          <Children value={value} depth={depth + 1} query={query} t={t} opts={opts} bundleTotal={bundleTotal} />
          {bundleMeta && <OutputTreeBundle n={bundleMeta.n} total={bundleMeta.total} depth={depth + 1} opts={opts} t={t} />}
        </>
      )}
    </div>
  )
}

// Renders the children of an object/array; arrays of objects become Bundle rows
// (default off, or when `opts.bundles` is on — see the array branch below).
function Children({ value, depth, query, t, opts, bundleTotal }: {
  value: object; depth: number; query: string; t: TFunction; opts?: OutputTreeOptions; bundleTotal?: number
}) {
  if (Array.isArray(value)) {
    const rows = (value as unknown[]).slice(0, MAX_ROWS)
    const asBundles = opts?.bundles && isBundleArray(value)
    const total = bundleTotal ?? (value as unknown[]).length
    return (
      <div>
        {rows.map((item, i) => {
          const label = t('tree.bundle', { n: i + 1 })
          if (query && !matches(item, label, query)) return null
          if (asBundles) {
            // Typed bundle row: "Bundel N · Collectie · k velden", Bundle 1 open, the rest collapsed.
            const bundleLabel = t('inspector.bundle', { n: i + 1 })
            const hint = `${t('inspector.collection')} · ${t('inspector.fieldCount', { count: fieldCount(item) })}`
            return (
              <BranchNode key={i} label={bundleLabel} value={item as object} depth={depth} defaultOpen={i === 0}
                hint={hint} query={query} t={t} opts={opts} bundleMeta={{ n: i + 1, total }} />
            )
          }
          return isBranch(item)
            ? <BranchNode key={i} label={label} value={item as object} depth={depth} defaultOpen={false} query={query} t={t} opts={opts} />
            : <LeafRow key={i} label={String(i + 1)} value={item} depth={depth} opts={opts} t={t} />
        })}
        {(value as unknown[]).length > MAX_ROWS && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px', paddingLeft: 4 + depth * 14 }}>
            {t('tree.more', { n: (value as unknown[]).length - MAX_ROWS })}
          </div>
        )}
      </div>
    )
  }
  const obj = value as Record<string, unknown>
  return (
    <div>
      {visibleEntries(obj).map(([k, v]) => {
        if (query && !matches(v, k, query)) return null
        // A capped list shows "x van y getoond" from its `<key>_total` companion.
        const total = obj[`${k}_total`]
        const hint = Array.isArray(v) && typeof total === 'number' && total > v.length
          ? t('tree.capped', { shown: v.length, total })
          : undefined
        return isBranch(v)
          ? <BranchNode key={k} label={k} value={v as object} depth={depth} defaultOpen={false} hint={hint} query={query} t={t} opts={opts}
              bundleTotal={typeof total === 'number' ? total : undefined} />
          : <LeafRow key={k} label={k} value={v} depth={depth} opts={opts} t={t} />
      })}
    </div>
  )
}

// Root of the Make-style bundle inspector: wraps the data in a searchable expandable field tree instead
// of a raw JSON dump (see file header). `typed`/`counts`/`bundles`/`expandSignal`/`collapseSignal` and
// `bundleTotal` are OUTPUT-TREE-TYPED-1's opt-in additions; every default keeps today's plain render.
export default function OutputTree({ data, searchable = true, typed, counts, bundles, expandSignal, collapseSignal, bundleTotal, fill }: {
  data: unknown; searchable?: boolean
  typed?: boolean; counts?: boolean; bundles?: boolean
  expandSignal?: number; collapseSignal?: number; bundleTotal?: number; fill?: boolean
}) {
  const { t } = useTranslation('workflows')
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const opts: OutputTreeOptions | undefined = (typed || counts || bundles || expandSignal !== undefined || collapseSignal !== undefined)
    ? { typed, counts, bundles, expandSignal, collapseSignal }
    : undefined

  if (data == null || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, padding: 4 }}>{t('tree.empty')}</p>
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)',
                  display: fill ? 'flex' : undefined, flexDirection: fill ? 'column' : undefined,
                  flex: fill ? 1 : undefined, minHeight: fill ? 0 : undefined }}>
      {/* Search across keys + values */}
      {searchable && (
        <div style={{ position: 'relative', padding: 6, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Search size={12} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('tree.search')} aria-label={t('tree.search')}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, border: '1px solid var(--border)',
                     borderRadius: 6, outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
        </div>
      )}
      <div style={fill ? { flex: 1, minHeight: 0, overflowY: 'auto', padding: 4 } : { maxHeight: 420, overflowY: 'auto', padding: 4 }}>
        {/* Root: a primitive renders as one row; objects/arrays render their children. */}
        {isBranch(data)
          ? <Children value={data as object} depth={0} query={query} t={t} opts={opts} bundleTotal={bundleTotal} />
          : <LeafRow label={t('canvas.response')} value={data} depth={0} opts={opts} t={t} />}
      </div>
    </div>
  )
}
