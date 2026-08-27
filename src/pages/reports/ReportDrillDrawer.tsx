/**
 * ReportDrillDrawer — the dynamic drill-down for a report KPI. Explains a number:
 * a breakdown of how it adds up (from already-loaded data, always available), the
 * underlying records (candidates / matches / applications — depends on the report,
 * fetched from `rowsEndpoint`, degrades to an empty list), and a Koios AI advice
 * block. Uses the shared RightDrawer shell so drawer chrome isn't re-implemented.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useReportDrill } from './useReportDrill'
import RightDrawer from '@/components/ui/RightDrawer'
import Avatar from '@/components/ui/Avatar'
import EntityLink from '@/components/ui/EntityLink'
import { GroupLabel, BodyText, Caption } from '@/components/ui/typography'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { formatNumber } from '@/lib/formatters'
import { initialsOf } from '@/lib/initials'

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
  // App-shell page key the rows deep-link to (SM-idiom row click-through:
  // name opens in-app, icon opens a new tab). Only set where the drill's rows
  // unambiguously ARE that entity and carry an `id` — else rows stay plain text.
  entityPage?: string
}

// One underlying record — shape varies per report, read defensively. Module-
// private since REPORTGRID-1 removed the inline list (ReportChartWithDrillList);
// the drawer is the only row renderer left.
type DrillRow = Record<string, unknown>
const rowTitle = (r: DrillRow) => String(r.name ?? r.label ?? r.title ?? r.full_name ?? r.id ?? '—')
const rowSub = (r: DrillRow) => {
  // `customer` = the opportunities drill's customer-name field (portie 5);
  // `assignee` = the tasks drill's assignee-name field (portie 6);
  // `wa_number` = the whatsapp KPI-drill's SERVER-MASKED number (§8/§9 — rendered
  // verbatim, the server decides how much of it anyone sees).
  const bits = [r.status, r.status_label, r.stage, r.funnel_label, r.client, r.function_title, r.city, r.customer, r.owner, r.assignee, r.wa_number]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return bits.slice(0, 2).join(' · ')
}

// The record list under a drill — the SM report-drawer idiom (KpiDrillDownDrawer):
// a search field once the list is worth filtering, avatar rows, a shown-of
// footer, and (when entityPage is set) the EntityLink click-through: name opens
// the record in-app, the trailing icon opens it in a new tab. Mounted with a
// per-drill key so the search resets when a different drill opens.
function DrillRecordsList({ rows, rowsTotal, entityPage }: { rows: DrillRow[]; rowsTotal: number; entityPage?: string }) {
  const { t } = useTranslation('analytics')
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q ? rows.filter(r => `${rowTitle(r)} ${rowSub(r)}`.toLowerCase().includes(q)) : rows

  return (
    <>
      {/* Search — ALWAYS visible and fixed above the list (SM idiom: the
          KpiDrillDownDrawer shows its search unconditionally). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 8, flexShrink: 0,
        background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
        <Search size={13} color="var(--text-muted)" aria-hidden="true" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('drill.search')} aria-label={t('drill.search')}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Rows scroll in a capped region so breakdown/advice below stay reachable. */}
        <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 12px' }}>{t('drill.noRecords')}</div>
        )}
        {filtered.map((r, i) => {
          const title = rowTitle(r)
          const sub = rowSub(r)
          const id = r.id != null ? String(r.id) : null
          return (
            <div key={id ?? i} style={{ padding: '8px 12px', borderTop: i ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={initialsOf(title, '–')} size={26} soft />
              <div style={{ flex: 1, minWidth: 0 }}>
                {entityPage && id ? (
                  <EntityLink page={entityPage} id={id} title={title}>{title}</EntityLink>
                ) : (
                  <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</BodyText>
                )}
                {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
              </div>
            </div>
          )
        })}
        </div>
        {/* Shown-of footer (SM idiom): fixed under the frame, never scrolls away —
            and it carries the server cap honestly. */}
        <Caption as="div" style={{ flexShrink: 0, padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
          {t('drill.shownOf', { shown: filtered.length, total: rowsTotal })}
        </Caption>
      </div>
    </>
  )
}

export default function ReportDrillDrawer({ drill, onClose }: { drill: DrillSpec | null; onClose: () => void }) {
  // 'common' alongside the feature namespace — the AI-Act disclosure hint
  // (AI-ACT-1) is shared copy, not per-report.
  const { t } = useTranslation(['analytics', 'common'])
  // Data layer: the underlying records + Koios advice for the open drill (§3).
  const { rows, rowsTotal, rowsLoading, rowsForbidden, advice, adviceLoading } = useReportDrill(drill)

  if (!drill) return null

  return (
    <RightDrawer title={drill.title} subtitle={drill.subtitle} onClose={onClose} width={460}>
      {/* The number being explained */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {typeof drill.value === 'number' ? formatNumber(drill.value) : drill.value}
        </div>
      </div>

      {/* Breakdown — how the number adds up (explains it from loaded data) */}
      {drill.breakdown && drill.breakdown.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <GroupLabel as="h4" style={{ marginBottom: 8 }}>{t('drill.breakdown')}</GroupLabel>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {drill.breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '9px 12px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{b.label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {typeof b.value === 'number' ? formatNumber(b.value) : b.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Underlying records — dynamic (candidates / matches / applications). Hidden,
          calmly, on a 403: the segment's own data permission was denied even though the
          report itself rendered fine — no error banner, the advice section still shows. */}
      {drill.rowsEndpoint && !rowsForbidden && (
        <section style={{ marginBottom: 20 }}>
          <GroupLabel as="h4" style={{ marginBottom: 8 }}>
            {drill.entityLabel ?? t('drill.records')}
          </GroupLabel>
          {rowsLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.loading')}</div>}
          {!rowsLoading && rows.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t('drill.noRecords')}</div>
          )}
          {!rowsLoading && rows.length > 0 && (
            <DrillRecordsList key={`${drill.title}-${JSON.stringify(drill.rowsParams ?? {})}`}
              rows={rows} rowsTotal={rowsTotal} entityPage={drill.entityPage} />
          )}
        </section>
      )}

      {/* Koios AI advice — always present so the AI angle is part of every drill.
          AI-ACT-1: the heading already names "Koios AI-advies" in visible text
          (drill.koios), so the mark only gains the disclosure hint as a tooltip —
          no second stacked label next to an already-explicit heading. */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <KoiosAiMark size={22} title={t('common:aiGeneratedHint', { defaultValue: 'Door Koios AI gegenereerd — controleer voor gebruik.' })} />
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t('drill.koios')}</h4>
        </div>
        <BodyText as="div" style={{ background: 'var(--color-primary-bg)', borderRadius: 10, padding: '12px 14px', lineHeight: 1.5 }}>
          {adviceLoading
            ? t('drill.loading')
            : advice ?? t('drill.noAdvice')}
        </BodyText>
      </section>
    </RightDrawer>
  )
}
