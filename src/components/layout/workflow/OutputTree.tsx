/**
 * OutputTree — Make-style bundle inspector: renders a step/module output as an
 * expandable field tree instead of a raw JSON blob. Root lists become
 * "Bundle 1..N", nested objects/arrays expand inline, and an optional search box
 * filters keys + values. The backend caps list keys at 100 rows and adds a
 * sibling `<key>_total`; that cap is surfaced as "x van y getoond".
 */
import { useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

// Cap what we render client-side so a huge (already BE-capped) list stays snappy.
const MAX_ROWS = 100

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

// One key:value leaf row.
function LeafRow({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const str = formatValue(value)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 4px', paddingLeft: 4 + depth * 14 }}>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>{label}:</span>
      <span title={typeof value === 'string' && value.length > 140 ? value : undefined}
        style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', wordBreak: 'break-word',
                 fontStyle: value == null ? 'italic' : 'normal' }}>
        {str}
      </span>
    </div>
  )
}

// An expandable branch (object or array) with its children rendered lazily.
function BranchNode({ label, value, depth, defaultOpen, hint, query, t }: {
  label: string; value: object; depth: number; defaultOpen: boolean; hint?: string | null
  query: string; t: TFunction
}) {
  const [open, setOpen] = useState(defaultOpen)
  // While searching, force branches open so hits are visible without clicking.
  const isOpen = query ? true : open
  const isArr = Array.isArray(value)
  const count = isArr ? (value as unknown[]).length : Object.keys(value).length

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '3px 4px',
                 paddingLeft: 4 + depth * 14, background: 'none', border: 'none', cursor: 'pointer',
                 textAlign: 'left', borderRadius: 6 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
        <ChevronRight size={11} color="var(--text-muted)"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }} />
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {hint ?? (isArr ? t('tree.items', { n: count }) : '')}
        </span>
      </button>
      {isOpen && <Children value={value} depth={depth + 1} query={query} t={t} />}
    </div>
  )
}

// Renders the children of an object/array; arrays of objects become Bundle rows.
function Children({ value, depth, query, t }: { value: object; depth: number; query: string; t: TFunction }) {
  if (Array.isArray(value)) {
    const rows = (value as unknown[]).slice(0, MAX_ROWS)
    return (
      <div>
        {rows.map((item, i) => {
          const label = t('tree.bundle', { n: i + 1 })
          if (!query || matches(item, label, query)) {
            return isBranch(item)
              ? <BranchNode key={i} label={label} value={item as object} depth={depth} defaultOpen={false} query={query} t={t} />
              : <LeafRow key={i} label={String(i + 1)} value={item} depth={depth} />
          }
          return null
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
          ? <BranchNode key={k} label={k} value={v as object} depth={depth} defaultOpen={false} hint={hint} query={query} t={t} />
          : <LeafRow key={k} label={k} value={v} depth={depth} />
      })}
    </div>
  )
}

export default function OutputTree({ data, searchable = true }: { data: unknown; searchable?: boolean }) {
  const { t } = useTranslation('workflows')
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  if (data == null || (typeof data === 'object' && Object.keys(data as object).length === 0)) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, padding: 4 }}>{t('tree.empty')}</p>
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* Search across keys + values */}
      {searchable && (
        <div style={{ position: 'relative', padding: 6, borderBottom: '1px solid var(--border)' }}>
          <Search size={12} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('tree.search')} aria-label={t('tree.search')}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, border: '1px solid var(--border)',
                     borderRadius: 6, outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
        </div>
      )}
      <div style={{ maxHeight: 420, overflowY: 'auto', padding: 4 }}>
        {/* Root: a primitive renders as one row; objects/arrays render their children. */}
        {isBranch(data)
          ? <Children value={data as object} depth={0} query={query} t={t} />
          : <LeafRow label={t('canvas.response')} value={data} depth={0} />}
      </div>
    </div>
  )
}
