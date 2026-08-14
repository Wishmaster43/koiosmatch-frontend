/**
 * ReportChartWithDrillList — the shared "chart on the left, its own drill list on
 * the right" layout. Adopted from the pattern Danny wants everywhere: clicking a
 * segment in the chart never opens a modal/overlay — it fills the ALWAYS-VISIBLE
 * list beside it with real rows from the report's own `rowsEndpoint` (the same
 * DrillSpec contract ReportDrillDrawer already uses, via useReportDrill — never a
 * client-side guess, never a second data path). The list panel keeps a fixed width
 * so the section's footprint never reflows between an empty and a filled state.
 * `ReportDrillDrawer` stays reserved for a genuinely deeper level (opening a full
 * entity record from a row) — this component does not replace that, it replaces
 * the "click a segment → open an overlay just to see the underlying rows" step.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { DrillSpec } from './ReportDrillDrawer'
import { rowTitle, rowSub } from './ReportDrillDrawer'
import { useReportDrill } from './useReportDrill'
import { formatNumber } from '@/lib/formatters'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'

const LIST_WIDTH = 300

export default function ReportChartWithDrillList({ chart, drill, placeholderLabel }: {
  chart: ReactNode                // the chart/segment picker — owns its own click handlers
  drill: DrillSpec | null         // the currently selected segment's DrillSpec, or null before any pick
  placeholderLabel?: string       // shown while no segment has been picked yet
}) {
  const { t } = useTranslation('analytics')
  // Same data layer as the drawer used: real rows AND Koios advice from the report's
  // own rowsEndpoint/adviceEndpoint — restores the advice block the old drawer
  // carried (KOIOS-DRILL-HOME-1), now following the selected segment inline.
  const { rows, rowsTotal, rowsLoading, rowsForbidden, advice, adviceLoading } = useReportDrill(drill)

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
      {/* Chart column — flexible width, never dictated by the list */}
      <div style={{ flex: 1, minWidth: 0 }}>{chart}</div>

      {/* List column — fixed width so the section never reflows between states */}
      <div style={{ width: LIST_WIDTH, flexShrink: 0, borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
        {!drill && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            {placeholderLabel ?? t('drill.records')}
          </div>
        )}

        {drill && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 4 }}>
              {drill.entityLabel ?? t('drill.records')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
              {drill.title} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {typeof drill.value === 'number' ? formatNumber(drill.value) : drill.value}
              </span>
            </div>

            {/* Koios AI advice for the selected segment — only when this drill declares
                an adviceEndpoint; no endpoint means no block at all (honest, no empty
                shell, no forever-spinner). Loading shows the shared "analysing" state
                inside KoiosAdviceBlock itself once advice arrives; while the request is
                in flight there is nothing to show yet, so render nothing until it resolves
                or comes back empty. */}
            {drill.adviceEndpoint && !adviceLoading && advice && (
              <div style={{ marginBottom: 16 }}>
                <KoiosAdviceBlock namespace="common" insights={[{ type: t('drill.koios'), color: 'var(--color-primary)', text: advice }]} />
              </div>
            )}

            {/* Hidden calmly on a 403 — the segment's own data permission, not an error */}
            {rowsForbidden && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.noRecords')}</div>
            )}
            {!rowsForbidden && rowsLoading && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.loading')}</div>
            )}
            {!rowsForbidden && !rowsLoading && rows.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.noRecords')}</div>
            )}
            {!rowsForbidden && !rowsLoading && rows.length > 0 && (
              <>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 340, overflowY: 'auto' }}>
                  {rows.map((r, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{rowTitle(r)}</div>
                      {rowSub(r) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{rowSub(r)}</div>}
                    </div>
                  ))}
                </div>
                {rows.length < rowsTotal && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    {t('drill.truncated', { shown: rows.length, total: rowsTotal })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
