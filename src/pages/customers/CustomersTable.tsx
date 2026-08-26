import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import type { CSSProperties, RefObject } from 'react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar, { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import CustomerStatusChip from '@/components/ui/CustomerStatusChip'
import BackofficeCouplingIndicator from '@/components/ui/BackofficeCouplingIndicator'
import { makeKoiosColumn } from '@/components/ui/koiosColumn'
import { useDateFormat } from '@/lib/datetime'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { useApps } from '@/context/AppsContext'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useCustomerAdvice } from '@/lib/useCustomerAdvice'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'
// Raw mono identity from the typography atom (HUISSTIJL: the font name lives in ONE place).
import { monoStyle } from '@/components/ui/typography'

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }
const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }

interface CustomersTableProps {
  rows: Customer[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Customer) => void
  // Cell deep-link: the Locaties/Afdelingen/Contactpersonen/Open-vacatures
  // ("Locations/Departments/Contact persons/Open vacancies") counts
  // open the drawer straight on that tab (mirrors the candidates last-contact cell).
  onOpenTab?: (row: Customer, tab: string) => void
  statusMeta: (v: string) => { label?: string; color?: string }
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  // SELECT-RACE-1: forwarded to DataTable as-is — inert header checkbox while a
  // new server result is in flight.
  selectionBusy?: boolean
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

// Count-cell → tab deep-link button (right-aligned, plain text look — only the
// cursor/hover signal it's clickable, no chip/underline noise on a numeric column).
const countBtn: CSSProperties = { display: 'inline-flex', color: 'var(--text-muted)', fontSize: 12,
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }
// Single-line name truncation (never wrap to 2 lines) — company names can run long
// ("Zorgpartners Midden-Holland"); the column is widened too (Danny 2026-07-14).
const nameEllipsis: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }

/**
 * CustomersTable — customer list, mirrors CandidatesTable: only declares columns,
 * the generic DataTable handles rendering/sorting/selection/empty states. Status
 * label + colour come from the tenant lookup via `statusMeta` (never hardcoded);
 * the chip is the shared SoftChip. Coloured chips vs. plain text is a per-column
 * tenant setting (Settings → Customers → Table display).
 */
export default function CustomersTable({
  rows, loading, selectedId, onSelect, onOpenTab, statusMeta,
  selectable = false, selectedIds, onToggleRow, onToggleAll, selectionBusy,
  stickyHeader = false, scrollParentRef,
}: CustomersTableProps) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  // Seeded lookup labels the server embedded in the row render in the user language.
  const seedLabel = useSeedLabel()
  // Tenant display settings (Settings → Customers → Table display).
  const settings = useAllSettings()
  const colorStatus = getBoolSetting(settings, 'customer_table_color_status', true)
  const colorOwner  = getBoolSetting(settings, 'customer_table_color_owner', true)
  const colorKoios  = getBoolSetting(settings, 'customer_table_color_koios', false)
  // Backoffice coupling column (JOB2): only shown for systems the tenant actually
  // enabled — mirrors BackofficeLinksTab's own isAppEnabled('hf'/'shiftmanager') gate.
  const apps = useApps()
  const showHelloflex = apps?.isAppEnabled('hf') ?? false
  const showShiftmanager = apps?.isAppEnabled('shiftmanager') ?? false
  // KLANT-FASE-1: the lifecycle-phase lookup (session-cached, one GET). Fetched here
  // rather than passed in, so the phase chip needs no new page-level plumbing.
  const { phaseMeta, phases } = useCustomerPhases()
  // Shared Koios advice resolver (honest gate + FE rule engine, mirrors candidates).
  const adviceOf = useCustomerAdvice()
  // Entry (default) phase — a Prospect has no status yet (Danny 02-08, mirrors the
  // candidate Lead rule). Resolved via the `is_default` FLAG, never an array
  // position, so reordering the phase lookup in Settings never silently misfires.
  const entryPhaseValue = phases.find(p => p.isDefault)?.value

  // Column order mirrors the candidates blueprint (§3A): identity → qualification →
  // status → counts → Koios → dates → accountmanager LAST (Danny 2026-07-14 table
  // standardization: Koios moves before "Aangemaakt", owner moves from #3 to last).
  // Column defs — memoized so DataTable's per-row memo (mirrors CandidatesTable,
  // §3A blueprint) actually holds: a stable `columns` reference means a row only
  // re-renders when ITS OWN data/selection changes.
  const columns: Column<Customer>[] = useMemo(() => [
    {
      key: 'name', header: t('cols.name'), sortable: true, sortValue: c => c.name,
      sticky: true, width: 270, nowrap: true,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar initials={c.initials} size={26} photo={c.logo ?? undefined} soft />
          <span style={{ color: 'var(--text)', fontSize: 12, ...nameEllipsis }} title={c.name}>{c.name}</span>
        </div>
      ),
    },
    {
      // Human-readable reference number (D-4, JOB1) — an identifier, so it sits
      // right after the name. Plain mono text, not the interactive ReferenceNumberChip:
      // a click-to-copy button nested inside this row's own click-to-open would either
      // double-fire or need stopPropagation contortions; the drawer chip already copies.
      key: 'referenceNumber', header: t('cols.referenceNumber'), nowrap: true,
      cellStyle: { ...mutedCell, ...monoStyle, fontVariantNumeric: 'tabular-nums' },
      sortable: true, sortValue: c => c.referenceNumber ?? '', render: c => c.referenceNumber || '—',
    },
    {
      // LOOKUP-I18N-1: the row embeds a flat industry label (no separate value) —
      // the seed default renders in the user's language, a tenant rename stays as typed.
      key: 'industry', header: t('cols.industry'), nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.industry,
      render: c => seedLabel('industries', { label: c.industry }) || '—',
    },
    {
      // KLANT-FASE-1: lifecycle phase (Prospect → Klant, "Customer") — its own axis, so it sits
      // NEXT TO the status chip: two chips, two questions. Label/colour come from the
      // tenant lookup; empty phase renders a dash rather than an empty chip.
      key: 'phase', header: t('cols.phase'), nowrap: true, sortable: true,
      sortValue: c => phaseMeta(c.phase).label,
      render: c => {
        if (!c.phase) return <span style={mutedCell}>—</span>
        const m = phaseMeta(c.phase)
        // Lifecycle axis → round soft chip, identical treatment to the candidate phase.
        return <SoftChip label={m.label} color={m.color} round />
      },
    },
    {
      // Danny 02-08: a Prospect (entry phase) has no status yet — the shared
      // CustomerStatusChip renders a dash instead of a chip for it (mirrors the
      // candidate deployability rule, § CustomerStatusChip docblock). Sort value
      // mirrors that: an entry-phase or unset status sorts as empty, never a
      // stray "undefined"/"null" label.
      key: 'status', header: t('cols.status'), sortable: true,
      sortValue: c => (c.phase && c.phase === entryPhaseValue) || !c.status ? '' : (statusMeta(String(c.status)).label ?? String(c.status)),
      // Customer.status is typed string|number for legacy/API reasons (mirrors the
      // debtor/reference-number style scalars); the chip only deals in slugs.
      // TRASH-OVERAL-2: a pending_erase row reads as "Prullenbak" ("Trash") (same chip on every entity table).
      render: c => c.lifecycle === 'pending_erase'
        ? <SoftChip label={t('common:trash.view')} color="var(--color-trash)" round />
        : <CustomerStatusChip status={c.status != null ? String(c.status) : null} phase={c.phase} plain={!colorStatus} round />,
    },
    { key: 'city',        header: t('cols.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city, render: c => c.city || '—' },
    // Counts deep-link to the matching drawer tab (Danny 2026-07-14) — zero still
    // clicks through (lands on the tab's own empty state + CTA).
    { key: 'locations',   header: t('cols.locations'),   nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.locationsCount,
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- count deep-link rendered AS the cell's own mono number; Button's fixed sm footprint cannot sit inside a 12px table cell (§14 r7 necessity)
      render: c => <button type="button" style={countBtn} aria-label={t('cols.locationsOpen')} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'locations') }}>{c.locationsCount}</button> },
    { key: 'departments', header: t('cols.departments'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.departmentsCount,
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- count deep-link rendered AS the cell's own mono number; Button's fixed sm footprint cannot sit inside a 12px table cell (§14 r7 necessity)
      render: c => <button type="button" style={countBtn} aria-label={t('cols.departmentsOpen')} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'departments') }}>{c.departmentsCount}</button> },
    { key: 'contacts',    header: t('cols.contacts'),    nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.contactsCount,
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- count deep-link rendered AS the cell's own mono number; Button's fixed sm footprint cannot sit inside a 12px table cell (§14 r7 necessity)
      render: c => <button type="button" style={countBtn} aria-label={t('cols.contactsOpen')} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'contacts') }}>{c.contactsCount}</button> },
    { key: 'openVacancies', header: t('cols.openVacancies'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.openVacanciesCount,
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- count deep-link rendered AS the cell's own mono number; Button's fixed sm footprint cannot sit inside a 12px table cell (§14 r7 necessity)
      render: c => <button type="button" style={countBtn} aria-label={t('cols.openVacanciesOpen')} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'vacancies') }}>{c.openVacanciesCount}</button> },
    // K8b: active-matches count, same ghost-button deep-link as openVacancies —
    // deep-links to the drawer's own "matches" tab (mapCustomer.ts already maps
    // activeMatchesCount, this column was simply missing).
    { key: 'activeMatches', header: t('cols.matches'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.activeMatchesCount,
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- count deep-link rendered AS the cell's own mono number; Button's fixed sm footprint cannot sit inside a 12px table cell (§14 r7 necessity)
      render: c => <button type="button" style={countBtn} aria-label={t('cols.activeMatchesOpen')} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'matches') }}>{c.activeMatchesCount}</button> },
    // Shared Koios column factory (Danny 05-08 consistency pass) — same header,
    // sort and cell as every other entity table; only the resolver differs.
    makeKoiosColumn({ adviceOf, colored: colorKoios, label: t('cols.koios') }),
    { key: 'created',     header: t('cols.createdAt'),   nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created, render: c => c.created ? formatDate(c.created) : '—' },
    {
      // Backoffice coupling scanning aid (JOB2) — not sortable: a compound
      // two-system state has no single clean sort order, it's a glance aid.
      key: 'coupling', header: t('cols.coupling'), nowrap: true,
      // KOPPELING-KOLOM: the same cell deep-link as the other count columns —
      // a ghost button (ring-only, no chip look) straight to the drawer's
      // Koppelingen tab, so a recruiter never has to open the drawer just to
      // check/fix a coupling.
      render: c => (
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- cell deep-link rendered AS the cell's own coupling-indicator content; Button's fixed sm footprint cannot sit inside a dense table cell (§14 r7 necessity)
        <button type="button" style={countBtn} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'koppelingen') }}
          aria-label={t('cols.coupling')}>
          <BackofficeCouplingIndicator helloflexLink={c.helloflexLink} shiftmanagerLink={c.shiftmanagerLink}
            showHelloflex={showHelloflex} showShiftmanager={showShiftmanager} />
        </button>
      ),
    },
    {
      key: 'accountManager', header: t('cols.accountManager'), sortable: true, sortValue: c => c.owner,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.owner && <Avatar initials={c.ownerInitials} size={18} color={colorOwner ? c.ownerColor : NEUTRAL_AVATAR} soft />}
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{c.owner || '—'}</span>
        </div>
      ),
    },
  ], [
    t, formatDate, seedLabel, phaseMeta, statusMeta, entryPhaseValue,
    colorStatus, colorKoios, colorOwner, adviceOf,
    showHelloflex, showShiftmanager, onOpenTab,
  ])

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      loading={loading}
      loadingText={t('page.loading')}
      emptyText={t('page.empty')}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      selectionBusy={selectionBusy}
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'created', dir: 'desc' }}
    />
  )
}
