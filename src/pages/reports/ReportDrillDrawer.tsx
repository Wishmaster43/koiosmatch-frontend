/**
 * ReportDrillDrawer — the dynamic drill-down for a report KPI. Explains a number:
 * a breakdown of how it adds up (from already-loaded data, always available), the
 * underlying records (candidates / matches / applications — depends on the report,
 * fetched from `rowsEndpoint`, degrades to an empty list), and a Koios AI advice
 * block. Uses the shared RightDrawer shell so drawer chrome isn't re-implemented.
 */
import { useTranslation } from 'react-i18next'
import { useReportDrill } from './useReportDrill'
import RightDrawer from '@/components/ui/RightDrawer'
import KoiosAiMark from '@/components/ui/KoiosAiMark'

// A drill descriptor built by each report for a clicked KPI/segment.
export interface DrillSpec {
  title: string                                   // metric label (drawer title)
  value: string | number                          // the number being explained
  subtitle?: string                               // e.g. the period / segment
  breakdown?: { label: string; value: string | number }[]  // how the number adds up
  entityLabel?: string                            // "candidates" / "matches" / …
  rowsEndpoint?: string                           // GET → underlying records
  rowsParams?: Record<string, unknown>            // query params for rowsEndpoint
  adviceEndpoint?: string                         // GET → Koios AI advice
  adviceParams?: Record<string, unknown>          // query params for adviceEndpoint
}

// One underlying record — shape varies per report, read defensively.
type DrillRow = Record<string, unknown>
const rowTitle = (r: DrillRow) => String(r.name ?? r.label ?? r.title ?? r.full_name ?? r.id ?? '—')
const rowSub   = (r: DrillRow) => {
  const bits = [r.status, r.stage, r.funnel_label, r.client, r.function_title, r.owner]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return bits.slice(0, 2).join(' · ')
}

export default function ReportDrillDrawer({ drill, onClose }: { drill: DrillSpec | null; onClose: () => void }) {
  const { t } = useTranslation('analytics')
  // Data layer: the underlying records + Koios advice for the open drill (§3).
  const { rows, rowsLoading, advice, adviceLoading } = useReportDrill(drill)

  if (!drill) return null

  return (
    <RightDrawer title={drill.title} subtitle={drill.subtitle} onClose={onClose} width={460}>
      {/* The number being explained */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {typeof drill.value === 'number' ? drill.value.toLocaleString('nl-NL') : drill.value}
        </div>
      </div>

      {/* Breakdown — how the number adds up (explains it from loaded data) */}
      {drill.breakdown && drill.breakdown.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                       letterSpacing: '0.05em', marginBottom: 8 }}>{t('drill.breakdown')}</h4>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {drill.breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '9px 12px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{b.label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {typeof b.value === 'number' ? b.value.toLocaleString('nl-NL') : b.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Underlying records — dynamic (candidates / matches / applications) */}
      {drill.rowsEndpoint && (
        <section style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                       letterSpacing: '0.05em', marginBottom: 8 }}>
            {drill.entityLabel ?? t('drill.records')}
          </h4>
          {rowsLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.loading')}</div>}
          {!rowsLoading && rows.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.noRecords')}</div>
          )}
          {!rowsLoading && rows.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {rows.slice(0, 50).map((r, i) => (
                <div key={i} style={{ padding: '9px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{rowTitle(r)}</div>
                  {rowSub(r) && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{rowSub(r)}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Koios AI advice — always present so the AI angle is part of every drill */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <KoiosAiMark size={22} />
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t('drill.koios')}</h4>
        </div>
        <div style={{ background: 'var(--color-primary-bg)', borderRadius: 10, padding: '12px 14px',
                      fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          {adviceLoading
            ? t('drill.loading')
            : advice ?? t('drill.noAdvice')}
        </div>
      </section>
    </RightDrawer>
  )
}
