/**
 * ShiftMatrixTable — candidate × month grid for the shift analysis. Rows are
 * candidates, columns are months; each cell shows the selected metric (prognose/
 * werkelijk × uren/diensten). Sticky first column + a totals row per month.
 *
 * Bespoke by design, not an oversight (§4 written-reason rule): this is a PIVOT
 * grid whose column set is runtime-computed (one column per month in range) plus
 * a totals footer row — the shared `components/ui/DataTable` models a fixed,
 * declared column list over a flat row list and has no footer/pivot concept, so
 * it can't express this shape. Kept as its own component; already tokens-only.
 * NOTE: renders all rows (mirrors the other SM tables); virtualize when the feed
 * scales to thousands (§9) — tracked as a perf follow-up.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatrixRow, MetricKey } from './hooks/useShiftAnalysis'
import { monthLabel } from './shiftMonth'

const thBase: CSSProperties = {
  padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap',
}
const tdBase: CSSProperties = { padding: '8px 12px', fontSize: 13, whiteSpace: 'nowrap' }

export default function ShiftMatrixTable({ columns, rows, metric }: {
  columns: string[]; rows: MatrixRow[]; metric: MetricKey
}) {
  const { t, i18n } = useTranslation('shiftmanager')

  // Column totals for the selected metric (footer row).
  const totals = columns.map(c => rows.reduce((s, r) => s + (Number(r.months[c]?.[metric]) || 0), 0))

  return (
    <div className="overflow-auto bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 240 + columns.length * 90 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, position: 'sticky', left: 0, zIndex: 2, textAlign: 'left', background: 'var(--surface)', minWidth: 220 }}>
              {t('shiftAnalysis.candidate')}
            </th>
            {columns.map(c => (
              <th key={c} style={{ ...thBase, textAlign: 'right' }}>{monthLabel(c, i18n.language)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} style={{ borderBottom: '1px solid var(--hover-bg)' }}>
              <td style={{ ...tdBase, position: 'sticky', left: 0, background: 'var(--surface)', textAlign: 'left', fontWeight: 500, color: 'var(--text)' }}>
                <div>{r.name || '—'}</div>
                {r.position && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.position}</div>}
              </td>
              {columns.map(c => {
                const v = Number(r.months[c]?.[metric]) || 0
                return (
                  <td key={c} style={{ ...tdBase, textAlign: 'right', color: v ? 'var(--text)' : 'var(--border)' }}>
                    {v || '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border)' }}>
            <td style={{ ...tdBase, position: 'sticky', left: 0, background: 'var(--hover-bg)', textAlign: 'left', fontWeight: 700 }}>
              {t('shiftAnalysis.total')}
            </td>
            {totals.map((tv, i) => (
              <td key={i} style={{ ...tdBase, textAlign: 'right', fontWeight: 700, background: 'var(--hover-bg)' }}>{tv || '—'}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
