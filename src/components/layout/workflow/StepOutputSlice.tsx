/**
 * StepOutputSlice — RUN-CONTROL-1 run-viewer output: renders ONE step's OWN
 * output slice instead of the merged pipeline blob. Steps array_merge their
 * input, so every step's `output` also carries upstream slices (the reason
 * every card used to show the same customer list); the slice this module
 * actually emitted lives under its own module_type key (sm_customers →
 * output.sm_customers), with column labels from /workflows/modules
 * output_fields. Lists are collapsible and default CLOSED above 10 rows.
 */
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fieldLabel } from './moduleI18n'
import type { ModuleCatalog } from './filterFieldCatalog'
import type { RunStep } from '@/types/reports'

// Lists longer than this start collapsed — a run with big syncs stays scannable.
const OPEN_THRESHOLD = 10
// Client-side render cap (the BE already caps at 100 + `<key>_total`).
const MAX_ROWS = 100

// Compact, single-line cell value; nested objects/arrays become a short JSON peek.
function cellValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'object') {
    try { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 60) + '…' : s } catch { return String(v) }
  }
  const s = String(v)
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

// The step's own rows. Slice key resolution: (1) the module_type key itself
// (sm_customers → output.sm_customers); (2) for replace/append modules (per the
// catalog's `emits`), the engine's canonical bundle key `candidates`
// (candidate_filter emits there). Passthrough modules never claim a slice —
// whatever lists their merged output carries belong to an upstream step.
function ownSlice(step: RunStep, catalog: ModuleCatalog): { rows: Array<Record<string, unknown>>; total: number } | null {
  const out = step.output as Record<string, unknown> | null | undefined
  const key = step.module_type
  if (!out || typeof out !== 'object' || Array.isArray(out) || !key) return null
  // A usable slice is a non-empty list of objects under this key.
  const listAt = (k: string) => {
    const v = out[k]
    return Array.isArray(v) && v.length > 0 && v[0] != null && typeof v[0] === 'object'
      ? (v as Array<Record<string, unknown>>) : null
  }
  let sliceKey = key
  let rows = listAt(key)
  if (!rows) {
    const emits = catalog[key]?.emits
    if (emits === 'replace' || emits === 'append') { sliceKey = 'candidates'; rows = listAt('candidates') }
  }
  if (!rows) return null
  const capTotal = out[`${sliceKey}_total`]
  return { rows, total: typeof capTotal === 'number' ? capTotal : rows.length }
}

export default function StepOutputSlice({ step, catalog }: { step: RunStep; catalog: ModuleCatalog }) {
  const { t } = useTranslation('workflows')
  const slice = ownSlice(step, catalog)
  // A passthrough module (e.g. wait) never claims a slice AND never gets the
  // generic items fallback either — that list is just the UPSTREAM step's own
  // output riding along untouched, so showing it here only duplicates that
  // step's card. Only gate on a KNOWN passthrough (catalog says so); while the
  // catalog is still loading / for an uncatalogued type, keep the old fallback.
  const emits = step.module_type ? catalog[step.module_type]?.emits : undefined
  const isPassthrough = !slice && emits === 'passthrough'
  // Legacy fallback for a non-passthrough module without a resolvable slice:
  // the BE's generic name+meta item list.
  const items = !slice && !isPassthrough && Array.isArray(step.items)
    ? (step.items as Array<{ name?: string; meta?: string | null }>) : null
  const itemsTotal = (step.items_total as number | undefined) ?? items?.length ?? 0
  const total = slice ? slice.total : itemsTotal
  // Collapsible list — default closed above 10 rows (Danny's run-viewer feedback).
  const [open, setOpen] = useState(total <= OPEN_THRESHOLD)

  if (isPassthrough) {
    return (
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {t('runViewer.passthrough')}
      </div>
    )
  }

  if (!slice && (!items || items.length === 0)) return null

  // Columns: the module's static output_fields catalog; fall back to the first
  // row's keys so an uncatalogued module still renders something honest.
  const fields = step.module_type ? catalog[step.module_type]?.outputFields ?? {} : {}
  const columns = slice
    ? (Object.keys(fields).length
        ? Object.keys(fields).filter(k => slice.rows[0] && k in slice.rows[0])
        : Object.keys(slice.rows[0] ?? {}).slice(0, 6))
    : []

  return (
    <div style={{ marginTop: 6 }}>
      {/* Collapse toggle: "output · N rows" */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
                 padding: '2px 0', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}>
        <ChevronRight size={11} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }} />
        <span style={{ fontWeight: 600 }}>{t('runViewer.output')}</span>
        <span>{t('runViewer.rows', { count: total })}</span>
      </button>

      {open && slice && (
        <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 4, border: '1px solid var(--border)', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(k => (
                  <th key={k} style={{ position: 'sticky', top: 0, background: 'var(--hover-bg)', textAlign: 'left',
                                       padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                                       whiteSpace: 'nowrap' }}>
                    {fieldLabel(t, fields[k] ?? k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.rows.slice(0, MAX_ROWS).map((row, i) => (
                <tr key={i}>
                  {columns.map(k => (
                    <td key={k} style={{ padding: '3px 8px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text)',
                                         borderTop: '1px solid var(--hover-bg)', whiteSpace: 'nowrap' }}>
                      {cellValue(row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {total > Math.min(slice.rows.length, MAX_ROWS) && (
            <div style={{ padding: '3px 8px', fontSize: 10, color: 'var(--text-muted)' }}>
              {t('runViewer.capped', { shown: Math.min(slice.rows.length, MAX_ROWS), total })}
            </div>
          )}
        </div>
      )}

      {open && !slice && items && (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4, border: '1px solid var(--border)', borderRadius: 6 }}>
          {items.map((it, j) => (
            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 8px',
                                  borderBottom: j < items.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
              <span style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name ?? '—'}</span>
              {it.meta && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{it.meta}</span>}
            </div>
          ))}
          {itemsTotal > items.length && (
            <div style={{ padding: '3px 8px', fontSize: 10, color: 'var(--text-muted)' }}>
              {t('runViewer.capped', { shown: items.length, total: itemsTotal })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
