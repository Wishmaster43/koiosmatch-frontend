import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '@/lib/datetime'
import DataTable from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import SoftChip from '@/components/ui/SoftChip'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import EntityNameCell from '@/components/ui/EntityNameCell'
import { initialsOf } from '@/lib/initials'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Opportunity } from '@/types/opportunity'
import type { Id, LookupOption } from '@/types/common'

interface OpportunitiesTableProps {
  rows: Opportunity[]
  loading?: boolean
  error?: unknown
  onRowClick?: (row: Opportunity) => void
  selectedId?: Id | null
  valueInHours?: boolean
  // Stage lookup (won/lost flags) — decides whether an overdue expected-close date
  // still counts as "late" (a closed deal is never overdue).
  stages?: LookupOption[]
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

// Calm neutral avatar tint — colour carries no meaning here, so all bubbles match
// (mirrors the candidate table's default; per-initial colours would be noise).
const NEUTRAL_AVATAR = '#9CA3AF'

// OpportunitiesTable — declares columns only; the shared DataTable owns sorting + states.
export default function OpportunitiesTable({ rows, loading, error, onRowClick, selectedId, valueInHours = false, stages = [], selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef }: OpportunitiesTableProps) {
  const { t } = useTranslation('opportunities')
  const locale = useLocale()
  const { formatDate } = useDateFormat()
  // Tenant display settings (Settings → Kansen → Tabelweergave). Coloured chips ON
  // by default, mirrors candidates/applications/customers.
  const settings = useAllSettings()
  const colorStage = getBoolSetting(settings, 'opportunity_table_color_stage', true)
  const colorOwner = getBoolSetting(settings, 'opportunity_table_color_owner', true)

  // Locale-aware EUR formatter (no decimals) for the value column.
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    [locale],
  )

  // A stage flagged isWon/isLost is terminal — a closed deal's expected-close date
  // is never "overdue" (§4: red/bold is a live-state signal, not a permanent mark).
  const isTerminalStage = (r: Opportunity) => stages.some(s => (s.isWon || s.isLost) && String(s.value) === String(r.stageValue))

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('cols.title'), sortable: true, sticky: true, width: 300, nowrap: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={r.initials} size={24} color={NEUTRAL_AVATAR} soft />
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 240 }} title={r.title}>{r.title}</span>
        </span>
      ) },
    // Klant — soft avatar + name (AVATAR-CHIP-1: same chip as the candidates identity
    // column), muted text keeps it reading as a secondary reference, not the row's own identity.
    { key: 'client', header: t('cols.client'), sortable: true, nowrap: true,
      render: r => <EntityNameCell name={r.client} textStyle={{ color: 'var(--text-muted)' }} /> },
    { key: 'stage',  header: t('cols.stage'), sortable: true, sortValue: r => r.stage,
      // Phase axis — round chip (StatusPill), mirrors candidates/applications (Danny 2026-07-14).
      render: r => {
        // ARCHIVE-1: archive state wins over the stage pill (mirrors VacanciesTable/
        // MatchesTable) — a soft-deleted row shown via include_archived=1 reads as
        // "Archived", not its stale stage.
        if (r.archived) return <SoftChip label={t('view.archived')} color="var(--text-muted)" round />
        if (!r.stage) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return colorStage ? <StatusPill label={r.stage} color={r.stageColor} /> : <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.stage}</span>
      } },
    // Value column follows the tenant setting: euro amount or hours. Regular weight,
    // same as the other plain-text columns (§4: bold is emphasis/active only, never
    // decoration on a data column — 500 still read as bold next to client/date/owner).
    { key: 'value',  header: t('cols.value'), align: 'right', sortable: true,
      sortValue: r => (valueInHours ? r.hours : r.value) ?? -1,
      render: r => {
        const v = valueInHours ? r.hours : r.value
        if (v == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return <span style={{ fontWeight: 400, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {valueInHours ? t('cols.hoursValue', { count: v }) : money.format(v)}
        </span>
      } },
    // Expected close date — red + bold when past AND the stage isn't already won/lost
    // (mirrors the tasks due-column overdue treatment).
    { key: 'expectedClose', header: t('cols.expectedClose'), sortable: true, sortValue: r => r.expectedCloseAt || '',
      render: r => {
        if (!r.expectedCloseAt) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const overdue = !isTerminalStage(r) && new Date(r.expectedCloseAt) < new Date(new Date().toDateString())
        return <span style={{ fontSize: 12, color: overdue ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: overdue ? 600 : 400 }}>{formatDate(r.expectedCloseAt)}</span>
      } },
    { key: 'date',   header: t('cols.date'),  sortable: true, sortValue: r => r.date || '',
      render: r => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(r.date)}</span> },
    // Owner — avatar + name. LAST column (§3A convention). The /opportunities
    // resource's owner is `{id, name}` only, no per-user colour field yet (verified
    // against OpportunityResource.php — BE gap, not a frontend bug), so `colorOwner`
    // toggles between Avatar's own deterministic name-hash palette (on, distinct per
    // owner) and a flat neutral grey (off) — swap in `r.ownerColor` once BE adds it.
    { key: 'owner',  header: t('cols.owner'), sortable: true, sortValue: r => r.owner,
      render: r => r.owner
        ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar initials={initialsOf(r.owner)} size={18} color={colorOwner ? undefined : NEUTRAL_AVATAR} soft />
            <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.owner}</span>
          </span>
        )
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ]

  // No surface-card wrapper: the DataTable renders directly on the page background
  // so the transparent rows + the sticky column's var(--bg) match (mirrors the
  // candidate table). A wrapper with a different bg makes the sticky column mismatch.
  return (
    <DataTable columns={columns} rows={rows} loading={loading}
      onRowClick={onRowClick} selectedId={selectedId}
      selectable={selectable} selectedIds={selectedIds} onToggleRow={onToggleRow} onToggleAll={onToggleAll}
      loadingText={t('loading')} emptyText={error ? t('error') : t('empty')}
      stickyHeader={stickyHeader} scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'date', dir: 'desc' }} />
  )
}
