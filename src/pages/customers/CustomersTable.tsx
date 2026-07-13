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
  statusMeta: (v: string) => { label?: string; color?: string }
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

/**
 * CustomersTable — customer list, mirrors CandidatesTable: only declares columns,
 * the generic DataTable handles rendering/sorting/selection/empty states. Status
 * label + colour come from the tenant lookup via `statusMeta` (never hardcoded);
 * the chip is the shared SoftChip. Coloured chips vs. plain text is a per-column
 * tenant setting (Settings → Customers → Table display).
 */
export default function CustomersTable({
  rows, loading, selectedId, onSelect, statusMeta,
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

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: t('cols.name'), sortable: true, sortValue: c => c.name,
      sticky: true, width: 200,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={c.initials} size={26} photo={c.logo ?? undefined} soft />
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{c.name}</span>
        </div>
      ),
    },
    {
      // NUMMER-1: human-readable reference number (D-4) — narrow, mono, muted.
      key: 'referenceNumber', header: t('cols.referenceNumber'), nowrap: true, width: 90,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' },
      sortable: true, sortValue: c => c.referenceNumber ?? '',
      render: c => c.referenceNumber || '—',
    },
    { key: 'debtorNumber', header: t('cols.debtorNumber'), nowrap: true, cellStyle: { ...mutedCell, fontFamily: 'var(--font-mono, monospace)' }, sortable: true, sortValue: c => c.debtorNumber, render: c => c.debtorNumber || '—' },
    {
      key: 'status', header: t('cols.status'), sortable: true, sortValue: c => statusMeta(String(c.status)).label ?? String(c.status),
      render: c => {
        const m = statusMeta(String(c.status))
        const label = c.statusLabel ?? m.label
        if (!colorStatus) return <span style={plainCell}>{label ?? '—'}</span>
        return <SoftChip label={label} color={c.statusColor ?? m.color} />
      },
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
    { key: 'industry',    header: t('cols.industry'),    nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.industry, render: c => c.industry || '—' },
    { key: 'locations',   header: t('cols.locations'),   nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.locationsCount,   render: c => c.locationsCount },
    { key: 'departments', header: t('cols.departments'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.departmentsCount, render: c => c.departmentsCount },
    { key: 'contacts',    header: t('cols.contacts'),    nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.contactsCount,    render: c => c.contactsCount },
    { key: 'openVacancies', header: t('cols.openVacancies'), nowrap: true, align: 'right', cellStyle: mutedCell, sortable: true, sortValue: c => c.openVacanciesCount, render: c => c.openVacanciesCount },
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
        return (
          <span title={a.reason || undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
              padding: '3px 8px', borderRadius: 99, background: meta.color + '14', color: meta.color,
              border: `1px solid ${meta.color}40`, whiteSpace: 'nowrap' }}>
            <Icon size={12} />{label}
          </span>
        )
      },
    },
    { key: 'city',        header: t('cols.city'),        nowrap: true, cellStyle: mutedCell, sortable: true, sortValue: c => c.city, render: c => c.city || '—' },
    { key: 'created',     header: t('cols.createdAt'),   nowrap: true, cellStyle: plainCell, sortable: true, sortValue: c => c.created, render: c => c.created ? formatDate(c.created) : '—' },
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
