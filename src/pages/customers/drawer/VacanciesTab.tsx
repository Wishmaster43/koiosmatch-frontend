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
import AddVacancyModal from '@/pages/vacancies/AddVacancyModal'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import EntityLink from '@/components/ui/EntityLink'
import SearchSelectGroup from '@/components/reports/filter/SearchSelectGroup'
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
  const queryClient = useQueryClient()
  const [statusOptions, setStatusOptions] = useState<StatusOpt[]>(SEED_STATUSES)
  // Defaults to just 'open' once the real lookup resolves; null = "not decided yet".
  const [selected, setSelected] = useState<string[] | null>(null)

  // Load the tenant vacancy-status lookup once; default-select the seeded 'open'
  // value if present, otherwise show everything (no artificial narrowing).
  useEffect(() => {
    api.get('/vacancy-statuses').then(r => {
      const raw = (unwrapList(r).rows) as Array<{ value?: string; label?: string; name?: string; active?: boolean }>
      const opts = raw.filter(o => o.active !== false).map(o => ({ value: String(o.value ?? o.name ?? ''), label: String(o.label ?? o.name ?? o.value ?? '') })).filter(o => o.value)
      if (opts.length) setStatusOptions(opts)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (selected !== null) return
    const hasOpen = statusOptions.some(o => o.value === 'open')
    setSelected(hasOpen ? ['open'] : statusOptions.map(o => o.value))
  }, [statusOptions, selected])

  const toggle = (v: string | number) => setSelected(p => { const s = p ?? []; const val = String(v); return s.includes(val) ? s.filter(x => x !== val) : [...s, val] })

  // Client-side filter over the rows already fetched (Danny: filter the tab's own
  // rows, not a new server call) — matched by the status VALUE (slug), not the label.
  // Depend on `selected` itself (stable state reference), not a derived `?? []`
  // array, which would be a fresh reference every render and defeat the memo.
  const filteredRows = useMemo(() => {
    if (!selected || selected.length === 0) return rows
    return rows.filter(v => selected.includes(v.status.value ?? ''))
  }, [rows, selected])
  const activeSelected = selected ?? []

  const columns: Column<VacancyRow>[] = [
    { key: 'title', header: t('vacancies.col.title'), sortable: true, sortValue: v => v.title, render: v => <EntityLink page="vacancies" id={v.id}>{v.title}</EntityLink> },
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    { key: 'status', header: t('vacancies.col.status'), render: v => <StatusPill label={v.status.label} color={v.status.color || '#9CA3AF'} /> },
    { key: 'applications', header: t('vacancies.col.applications'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: v => v.applications, render: v => v.applications },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ maxWidth: 220, flex: 1 }}>
          <SearchSelectGroup group={{ key: 'status', label: t('vacancies.filter.status'), options: statusOptions, selected: activeSelected, onToggle: toggle }} />
        </div>
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
