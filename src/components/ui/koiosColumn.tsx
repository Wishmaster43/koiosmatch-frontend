/**
 * koiosColumn — builds the ONE "Koios" advice column shared by every entity
 * table (candidates, applications, vacancies, matches, opportunities, tasks,
 * outreach, customers). See `makeKoiosColumn`'s own doc comment below for the
 * full rationale.
 */
import type { Column } from '@/components/ui/DataTable'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { KoiosAdvicePill } from '@/lib/koiosAdviceMeta'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'

export interface KoiosColumnOptions<Row> {
  // Per-entity resolver — the ONLY thing that differs between tables. Reads
  // whatever fields the row already carries; never triggers a fetch.
  adviceOf: (row: Row) => KoiosAdvice | null | undefined
  // Tenant "colour this column" setting (mirrors every other soft-chip toggle,
  // one flag per column, default false like the candidates/customers precedent).
  colored: boolean
  // Already-translated header text (caller resolves it via t(), §5) — the mark
  // is prepended here so every table gets the identical brand glyph + label.
  label: string
  // Resolve an i18n label when the resolver only returns an action slug.
  fallbackLabel?: (action: string) => string
  key?: string
}

/**
 * makeKoiosColumn — the ONE "Koios" column definition every entity table uses
 * (candidates, applications, vacancies, matches, opportunities, tasks, outreach,
 * customers — Danny 05-08 "CONSISTENT!!"). Was hand-rolled per table (header
 * markup + sortValue + cell render duplicated 3×); this factory is now the
 * single source for the header (mark + label), the sort key (advice action,
 * dash/empty sinks to one bucket) and the cell (the shared KoiosAdvicePill).
 * Only the advice LOGIC differs per entity — that lives in each table's own
 * adviceOf(row), never here.
 */
export function makeKoiosColumn<Row>({ adviceOf, colored, label, fallbackLabel, key = 'koios' }: KoiosColumnOptions<Row>): Column<Row> {
  return {
    key,
    nowrap: true,
    sortable: true,
    sortValue: row => adviceOf(row)?.action ?? '',
    header: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <KoiosAiMark size={16} />{label}
      </span>
    ),
    render: row => <KoiosAdvicePill advice={adviceOf(row)} colored={colored} fallbackLabel={fallbackLabel} />,
  }
}
