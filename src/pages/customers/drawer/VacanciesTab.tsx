/**
 * VacanciesTab — the customer's vacancies (via useCustomerVacancies → GET
 * /vacancies?client_id={id}), with a multi-select STATUS filter above the table —
 * the same searchable checkbox-list pattern as the right filter panel's
 * Accountmanager filter (SearchSelectGroup), reused here rather than hand-rolled.
 * Defaults to only the 'open'-like status (Danny: "standaard alleen open tonen, je
 * moet meerdere kunnen kiezen") and filters client-side over the rows already
 * fetched. Statuses come from the tenant vacancy-status lookup (GET
 * /vacancy-statuses) — VacancyLookupsProvider is only mounted around the Vacancies
 * page, not the customer drawer, so this fetches the same endpoint directly.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Search } from 'lucide-react'
import AddVacancyModal from '@/pages/vacancies/AddVacancyModal'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import StatusFilterSelect, { useStatusFilter } from './StatusFilterSelect'
import api, { unwrapList } from '@/lib/api'
import { useCustomerVacancies } from '../hooks/useCustomerDrawerData'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

interface StatusOpt { value: string; label: string }

// Seed fallback (mirrors VacancyLookupsContext's DEFAULT_VACANCY_STATUSES) — used
// only until GET /vacancy-statuses answers, or if it's unavailable.
const SEED_STATUSES: StatusOpt[] = [
  { value: 'open', label: 'Open' }, { value: 'online', label: 'Online' },
  { value: 'concept', label: 'Concept' }, { value: 'paused', label: 'Gepauzeerd' }, { value: 'closed', label: 'Gesloten' },
]

export default function VacanciesTab({ customerId, customerName, params }: { customerId?: Id; customerName?: string; params?: Record<string, unknown> }) {
  const { t } = useTranslation('customers')
  const { rows, loading } = useCustomerVacancies(customerId, params)
  // Create a vacancy straight from the customer (Danny 28-07) — the client is fixed to
  // this customer, so the modal shows it read-only instead of asking again.
  const [adding, setAdding] = useState(false)
  // Free-text search over the title (Danny 28-07) — the list can run to dozens of rows.
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const [statusOptions, setStatusOptions] = useState<StatusOpt[]>(SEED_STATUSES)
  // Has the REAL lookup answered? The seed list must never decide the default
  // selection — see the id/name bug documented below.
  const [resolved, setResolved] = useState(false)

  // Load the tenant vacancy-status lookup once.
  // BUG FIX (Danny 28-07: "Open maar staat niet aangevinkt?????" while the table said
  // "Geen vacatures voor deze klant"): this mapped the option VALUE off `name`, but
  // `GET /vacancy-statuses` returns no `value` at all — it returns `id` (a uuid) +
  // `name`. A vacancy row carries that UUID in `status.value`, so the filter compared
  // "Open" against a uuid, matched nothing, and silently hid every vacancy. The option
  // value is now the id, exactly what the rows carry.
  useEffect(() => {
    api.get('/vacancy-statuses').then(r => {
      const raw = (unwrapList(r).rows) as Array<{ id?: string; value?: string; label?: string; name?: string; active?: boolean }>
      const opts = raw.filter(o => o.active !== false)
        .map(o => ({ value: String(o.id ?? o.value ?? o.name ?? ''), label: String(o.label ?? o.name ?? '') }))
        .filter(o => o.value)
      if (opts.length) setStatusOptions(opts)
      setResolved(true)
    }).catch(() => setResolved(true))
  }, [])

  // The SHARED status filter, same as every other sub-entity list (Danny 28-07:
  // "vacature status is niet hetzelfde als locatie status???"). Two things make it safe
  // here: it is handed the statuses ONLY once the real lookup resolved — otherwise it
  // would propose a default off the seed list's slugs, the other half of the same bug —
  // and `keyOf` points it at this row's status OBJECT, because comparing a uuid to an
  // object matches nothing, silently.
  const { value: statusFilter, toggle: toggleStatus, filtered: statusRows } =
    useStatusFilter(rows, resolved ? statusOptions.map(o => ({ value: o.value, label: o.label })) : [],
      v => String(v.status.value ?? ''))


  // Free-text search runs on top of the status filter's rows.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? statusRows.filter(v => String(v.title ?? '').toLowerCase().includes(q)) : statusRows
  }, [statusRows, search])

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <EntityLink page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar in the house order (Danny 28-07): search left, status filter right,
          add trigger last — the same left-to-right reading as every other sub-entity
          list. The filter renders `plain` so it is white like the pickers beside it. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120, padding: '6px 10px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('vacancies.searchPlaceholder')} aria-label={t('vacancies.searchPlaceholder')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
        </div>
        <StatusFilterSelect value={statusFilter} onToggle={toggleStatus}
          statuses={statusOptions.map(o => ({ value: o.value, label: o.label }))} />
        <DrawerAddButton onClick={() => setAdding(true)} label={t('vacancies.add')} />
      </div>
      <DataTable columns={columns} rows={filteredRows} loading={loading} loadingText={t('page.loading')} emptyText={t('vacancies.empty')} />

      {/* Refetch this customer's vacancy list on create, so the new row appears here. */}
      {/* The modal reads useVacancyLookups, whose provider is only mounted around the
          Vacancies PAGE — opening it from this drawer threw "must be used within a
          VacancyLookupsProvider" (caught live 28-07). Mount the provider around the modal
          itself so the same component works from either entry point. */}
      {adding && (
        <VacancyLookupsProvider>
        <AddVacancyModal
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'vacancies'] }) }}
          lockCustomerId={customerId != null ? String(customerId) : undefined}
          lockCustomerName={customerName}
        />
        </VacancyLookupsProvider>
      )}
    </div>
  )
}
