import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import Avatar, { NEUTRAL_AVATAR } from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

const mutedCell = { color: 'var(--text-muted)', fontSize: 12 }
const plainCell = { color: 'var(--text)', fontSize: 12 }

interface VacanciesTableProps {
  rows: Vacancy[]
  loading?: boolean
  selectedId?: Id | null
  onSelect?: (row: Vacancy) => void
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

/**
 * VacanciesTable — vacancy list as a loose component. Only declares the columns;
 * sorting, selection and the loading/empty states live in the shared DataTable.
 * Mirrors CandidatesTable / ApplicationsTable.
 */
export default function VacanciesTable({ rows, loading, selectedId, onSelect, selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef }: VacanciesTableProps) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat()
  const { statusMeta } = useVacancyLookups()
  // Tenant display settings (mirror the candidate table). Coloured chips carry
  // meaning (status/published/owner), so they default ON; a tenant can flatten them.
  const settings = useAllSettings()
  const colorStatus    = getBoolSetting(settings, 'vacancy_table_color_status', true)
  const colorPublished = getBoolSetting(settings, 'vacancy_table_color_published', true)
  const colorOwner     = getBoolSetting(settings, 'vacancy_table_color_owner', true)

  // Column order mirrors the candidates blueprint (§3A): identity → client → status
  // → counts → dates → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<Vacancy>[] = [
    {
      key: 'title', header: t('columns.title'), sortable: true, sortValue: r => r.title,
      sticky: true, width: 320, nowrap: true,
      render: r => <span style={{ color: 'var(--text)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }} title={r.title}>{r.title}</span>,
    },
    {
      key: 'client', header: t('columns.client'), nowrap: true, sortable: true, sortValue: r => r.clientName,
      render: r => r.clientName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={(r.clientName[0] ?? '?').toUpperCase()} size={20} soft />
          <span style={{ color: 'var(--text)', fontSize: 12 }}>{r.clientName}</span>
        </div>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'status', header: t('columns.status'), sortable: true, sortValue: r => r.statusLabel || (r.statusValue ?? ''),
      render: r => {
        // Archive state wins over the status pill (mirrors CandidatesTable): a soft-
        // deleted row shown via include_archived=1 reads as "Archived", not its stale status.
        if (r.archived) return <SoftChip label={t('page.archivedView')} color="var(--text-muted)" round />
        // Prefer the resolved label/colour from the row; fall back to the lookup.
        const m = r.statusLabel ? { label: r.statusLabel, color: r.statusColor } : statusMeta(r.statusValue != null ? String(r.statusValue) : null)
        if (!m.label) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return colorStatus ? <StatusPill label={m.label} color={m.color} /> : <span style={plainCell}>{m.label}</span>
      },
    },
    {
      key: 'leads', header: t('columns.leads'), align: 'left', sortable: true, sortValue: r => r.leadsCount,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' },
      render: r => r.leadsCount ?? 0,
    },
    {
      key: 'applications', header: t('columns.applications'), sortable: true, sortValue: r => r.applicationsCount,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' },
      render: r => r.applicationsCount ?? 0,
    },
    {
      key: 'published', header: t('columns.published'), nowrap: true, sortable: true, sortValue: r => (r.published ? 1 : 0),
      render: r => {
        if (!r.published) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('publishedState.no')}</span>
        // Icon + text so the "published" state never relies on colour alone (a11y).
        // Shared pill (SoftChip round + icon) — identical to the candidates/customers
        // koios pill (Danny 2026-07-14 unification).
        return colorPublished ? (
          <SoftChip color="var(--color-success)" round label={<><Globe size={12} /> {t('publishedState.yes')}</>} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...plainCell }}>
            <Globe size={12} /> {t('publishedState.yes')}
          </span>
        )
      },
    },
    {
      // VAC-AGENT-1: the linked AI agent (Option A: linking IS the interview toggle
      // for this vacancy) — name, or an em-dash when none is linked.
      key: 'aiAgent', header: t('columns.aiAgent'), nowrap: true, sortable: true, sortValue: r => r.aiAgentName ?? '',
      render: r => r.aiAgentName ? <span style={plainCell}>{r.aiAgentName}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'createdAt', header: t('columns.createdAt'), nowrap: true, cellStyle: mutedCell,
      sortable: true, sortValue: r => r.createdSort ?? r.created, render: r => formatDate(r.created),
    },
    {
      key: 'owner', header: t('columns.owner'), sortable: true, sortValue: r => r.owner?.name ?? '',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {r.owner?.name && <Avatar initials={r.owner.initials} size={22} color={colorOwner ? r.owner.color : NEUTRAL_AVATAR} soft />}
          <span style={mutedCell}>{r.owner?.name || '—'}</span>
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
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      loading={loading}
      loadingText={t('page.loading')}
      emptyText={t('page.empty')}
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'created', dir: 'desc' }}
    />
  )
}
