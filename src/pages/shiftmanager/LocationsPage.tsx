/**
 * LocationsPage — the Shiftmanager locations list: KPI strip, filterable/sortable
 * table and a detail drawer, all driven by the read-only mirrored SM data
 * (useSmLocations).
 */
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Layers } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { toggleInList } from '@/lib/selectionSet'
import { usePagedRows } from '@/hooks/usePagedRows'
import { distinctSortedValues } from '@/components/reports/distinctSortedValues'
import LocationsTable from './LocationsTable'
import LocationDrawer from './LocationDrawer'
import SmKpiStrip from './SmKpiStrip'
import { SmPaginationBar } from './SmPaginationBar'
import { useSmLocations } from './hooks/useSmLocations'
import type { SmLocationRow } from '@/types/shiftmanager'
import { ListPageShell } from '@/components/ui/ListPageShell'
import { SmLoadErrorBanner } from './SmLoadErrorBanner'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const { t } = useTranslation('shiftmanager')
  // Data (fetch + transform) lives in the shared hook (§3).
  const { locations, isLoading, isError, refetch } = useSmLocations()
  const [search]                  = useState('')
  const [selected,  setSelected]  = useState<SmLocationRow | null>(null)
  const [selStatuses,  setSelStatuses]  = useState<string[]>([])
  const [selCustomers,   setSelCustomers]   = useState<string[]>([])
  const [selCities,    setSelCities]    = useState<string[]>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Distinct status values present in the loaded locations, sorted, for the status filter options.
  const statusOptions = useMemo(() => distinctSortedValues(locations, l => l.status), [locations])
  // Distinct customer names present in the loaded locations, sorted, for the customer filter options.
  const customerOptions  = useMemo(() => distinctSortedValues(locations, l => l.customer), [locations])
  // Distinct city values present in the loaded locations, sorted, for the city filter options.
  const cityOptions  = useMemo(() => distinctSortedValues(locations, l => l.city), [locations])

  // Builds the status/customer/city filter definitions handed to the shared right-panel filter UI.
  const filterGroups = useMemo(() => [
    { key: 'status',  label: t('locationsPage.filter.status'),
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: (val: string) => setSelStatuses(prev => toggleInList(prev, val)) },
    // English group identifiers (§0.1): the label stays translated, the key never is.
    { key: 'customer', label: t('locationsPage.filter.customer'),
      options: customerOptions.map(k => ({ value: k, label: k })),
      selected: selCustomers,   onToggle: (val: string) => setSelCustomers(prev => toggleInList(prev, val)) },
    { key: 'city',    label: t('locationsPage.filter.city'),
      options: cityOptions.map(s => ({ value: s, label: s })),
      selected: selCities,    onToggle: (val: string) => setSelCities(prev => toggleInList(prev, val)) },
  ], [t, statusOptions, customerOptions, cityOptions, selStatuses, selCustomers, selCities])

  // Registers this page's filter groups with the shared right panel, and unregisters them on unmount so they do not leak into another page.
  useEffect(() => {
    registerFilters('locations-page', filterGroups)
    return () => unregisterFilters('locations-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Applies the active status/customer/city filters plus the free-text search (name/customer/city) in one pass.
  const filtered = useMemo(() => {
    let rows = locations
    if (selStatuses.length) rows = rows.filter(l => selStatuses.includes(l.status as string))
    if (selCustomers.length)  rows = rows.filter(l => selCustomers.includes(l.customer as string))
    if (selCities.length)   rows = rows.filter(l => selCities.includes(l.city as string))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(l =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.customer ?? '').toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [locations, search, selStatuses, selCustomers, selCities])

  const { page, setPage, pageSize, setPageSize, totalPages, paged } = usePagedRows(filtered)

  // KPI cards — translated labels; values are derived from the live list.
  const kpis = [
    { label: t('locationsPage.kpi.total'),           value: locations.length,                                    color: 'var(--color-primary-text)',   bg: 'var(--color-primary-bg)',   Icon: MapPin },
    { label: t('locationsPage.kpi.active'),          value: locations.filter(l => (l.status ?? '').toLowerCase() === 'active').length, color: 'var(--color-success-text)',   bg: 'var(--color-success-bg)',   Icon: Building2 },
    { label: t('locationsPage.kpi.departments'),     value: locations.reduce((s,l) => s + (l.departments ?? []).length, 0), color: 'var(--color-warning-text)', bg: 'var(--color-warning-bg)',   Icon: Layers },
    { label: t('locationsPage.kpi.linkedCustomers'), value: [...new Set(locations.map(l => l.customer))].length,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
  ]

  return (
    <ListPageShell minWidth={0} aside={<LocationDrawer loc={selected} onClose={() => setSelected(null)} />}>

      {/* KPI strip — shared SmKpiStrip (§3 consolidation) */}
      <SmKpiStrip kpis={kpis} />

      {/* Table — shared DataTable (sticky header, sorting, soft-chip status colours) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
        {/* Error state (§3): the mirror fetch failed, say so and offer a retry. */}
        <SmLoadErrorBanner isError={isError} onRetry={refetch} />
        <LocationsTable rows={paged} loading={isLoading} selectedId={selected?.id}
          onSelect={loc => setSelected(prev => prev?.id === loc.id ? null : loc)} />
      </div>

      <SmPaginationBar page={page} totalPages={totalPages} totalRows={filtered.length} pageSize={pageSize}
        onPageChange={setPage} setPage={setPage} setPageSize={setPageSize} />
    </ListPageShell>
  )
}
