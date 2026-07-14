import { useTranslation } from 'react-i18next'
import type { ComponentType, CSSProperties, RefObject } from 'react'
import { Phone, CalendarPlus, Sparkles } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { useDateFormat } from '@/lib/datetime'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }
const plainCell: CSSProperties = { color: 'var(--text)', fontSize: 12 }
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>
const NEUTRAL_AVATAR = '#9CA3AF'

type LucideIcon = ComponentType<{ size?: number; style?: CSSProperties }>

// Icon + colour per Koios advice action (hex so `+ alpha` tints work). The label
// itself comes from the backend (already localised); the raw action is the fallback.
const ADVICE_META: Record<string, { icon: LucideIcon; color: string }> = {
  contact:   { icon: Phone,        color: '#D97706' },
  follow_up: { icon: CalendarPlus, color: '#2563EB' },
  default:   { icon: Sparkles,     color: '#6B7280' },
}

interface CustomersTableProps {
  rows: Customer[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Customer) => void
  // Cell deep-link: the Locaties/Afdelingen/Contactpersonen/Open-vacatures counts
  // open the drawer straight on that tab (mirrors the candidates last-contact cell).
  onOpenTab?: (row: Customer, tab: string) => void
  statusMeta: (v: string) => { label?: string; color?: string }
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
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
  selectable = false, selectedIds, onToggleRow, onToggleAll,
  stickyHeader = false, scrollParentRef,
}: CustomersTableProps) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  // Tenant display settings (Settings → Customers → Table display).
  const settings = useAllSettings()
  const colorStatus = getBoolSetting(settings, 'customer_table_color_status', true)
  const colorOwner  = getBoolSetting(settings, 'customer_table_color_owner', true)
  const colorKoios  = getBoolSetting(settings, 'customer_table_color_koios', false)

  // Column order mirrors the candidates blueprint (§3A): identity → qualification →
  // status → counts → Koios → dates → accountmanager LAST (Danny 2026-07-14 table
  // standardization: Koios moves before "Aangemaakt", owner moves from #3 to last).
  const columns: Column<Customer>[] = [
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
    { key: 'industry',    header: t('cols.industry'),    nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.industry, render: c => c.industry || '—' },
    {
      key: 'status', header: t('cols.status'), sortable: true, sortValue: c => statusMeta(String(c.status)).label ?? String(c.status),
      render: c => {
        const m = statusMeta(String(c.status))
        const label = c.statusLabel ?? m.label
        if (!colorStatus) return <span style={plainCell}>{label ?? '—'}</span>
        // Status is a lifecycle axis — round chip, mirrors candidates (Danny 2026-07-14).
        return <SoftChip label={label} color={c.statusColor ?? m.color} round />
      },
    },
    { key: 'city',        header: t('cols.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city, render: c => c.city || '—' },
    // Counts deep-link to the matching drawer tab (Danny 2026-07-14) — zero still
    // clicks through (lands on the tab's own empty state + CTA).
    { key: 'locations',   header: t('cols.locations'),   nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.locationsCount,
      render: c => <button style={countBtn} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'locations') }}>{c.locationsCount}</button> },
    { key: 'departments', header: t('cols.departments'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.departmentsCount,
      render: c => <button style={countBtn} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'departments') }}>{c.departmentsCount}</button> },
    { key: 'contacts',    header: t('cols.contacts'),    nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.contactsCount,
      render: c => <button style={countBtn} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'contacts') }}>{c.contactsCount}</button> },
    { key: 'openVacancies', header: t('cols.openVacancies'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.openVacanciesCount,
      render: c => <button style={countBtn} onClick={e => { e.stopPropagation(); onOpenTab?.(c, 'vacancies') }}>{c.openVacanciesCount}</button> },
    {
      key: 'koios', nowrap: true, sortable: true, sortValue: c => c.koiosAdvice?.action ?? '',
      header: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><KoiosAiMark size={16} />{t('cols.koios')}</span>,
      render: c => {
        const a = c.koiosAdvice
        if (!a || !a.action || a.action === 'none') return dash
        const label = a.label || a.action
        if (!colorKoios) return <span style={plainCell} title={a.reason || undefined}>{label}</span>
        const meta = ADVICE_META[a.action] ?? ADVICE_META.default
        const Icon = meta.icon
        // Shared pill (SoftChip round + icon) — identical to the candidates koios
        // pill and the vacancies "published" pill (Danny 2026-07-14 unification).
        return <SoftChip title={a.reason || undefined} color={meta.color} round label={<><Icon size={12} />{label}</>} />
      },
    },
    { key: 'created',     header: t('cols.createdAt'),   nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created, render: c => c.created ? formatDate(c.created) : '—' },
    {
      key: 'accountManager', header: t('cols.accountManager'), sortable: true, sortValue: c => c.owner,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.owner && <Avatar initials={c.ownerInitials} size={18} color={colorOwner ? c.ownerColor : NEUTRAL_AVATAR} soft />}
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{c.owner || '—'}</span>
        </div>
      ),
    },
  ]

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
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'created', dir: 'desc' }}
    />
  )
}
