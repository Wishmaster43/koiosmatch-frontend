/**
 * LocationsPage — the Shiftmanager locations list: KPI strip, filterable/sortable
 * table and a detail drawer, all driven by the read-only mirrored SM data
 * (useSmLocations).
 */
import { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Layers } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import LocationsTable from './LocationsTable'
import PaginationBar from '@/components/ui/PaginationBar'
import LocationDrawer from './LocationDrawer'
import SmKpiStrip from './SmKpiStrip'
import { useSmLocations } from './hooks/useSmLocations'
import type { SmLocationRow } from '@/types/shiftmanager'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const { t } = useTranslation('shiftmanager')
  // Data (fetch + transform) lives in the shared hook (§3).
  const { locations } = useSmLocations()
  const [search]                  = useState('')
  const [selected,  setSelected]  = useState<SmLocationRow | null>(null)
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(50)
  const [selStatuses,  setSelStatuses]  = useState<string[]>([])
  const [selCustomers,   setSelCustomers]   = useState<string[]>([])
  const [selCities,    setSelCities]    = useState<string[]>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  // Distinct status values present in the loaded locations, sorted, for the status filter options.
  const statusOptions = useMemo(() => [...new Set(locations.map(l => l.status).filter((x): x is string => Boolean(x)))].sort(), [locations])
  // Distinct customer names present in the loaded locations, sorted, for the customer filter options.
  const customerOptions  = useMemo(() => [...new Set(locations.map(l => l.customer).filter((x): x is string => Boolean(x)))].sort(), [locations])
  // Distinct city values present in the loaded locations, sorted, for the city filter options.
  const cityOptions  = useMemo(() => [...new Set(locations.map(l => l.city).filter((x): x is string => Boolean(x)))].sort(), [locations])

  // Builds the status/customer/city filter definitions handed to the shared right-panel filter UI.
  const filterGroups = useMemo(() => [
    { key: 'status',  label: t('locationsPage.filter.status'),
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: toggle(setSelStatuses) },
    { key: 'klant',   label: t('locationsPage.filter.customer'),
      options: customerOptions.map(k => ({ value: k, label: k })),
      selected: selCustomers,   onToggle: toggle(setSelCustomers) },
    { key: 'stad',    label: t('locationsPage.filter.city'),
      options: cityOptions.map(s => ({ value: s, label: s })),
      selected: selCities,    onToggle: toggle(setSelCities) },
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

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  // KPI cards — translated labels; values are derived from the live list.
  const kpis = [
    { label: t('locationsPage.kpi.total'),           value: locations.length,                                    color: 'var(--color-primary-text)',   bg: 'var(--color-primary-bg)',   Icon: MapPin },
    { label: t('locationsPage.kpi.active'),          value: locations.filter(l => l.status === 'Actief').length, color: 'var(--color-success-text)',   bg: 'var(--color-success-bg)',   Icon: Building2 },
    { label: t('locationsPage.kpi.departments'),     value: locations.reduce((s,l) => s + (l.departments ?? []).length, 0), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)',   Icon: Layers },
    { label: t('locationsPage.kpi.linkedCustomers'), value: [...new Set(locations.map(l => l.customer))].length,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip — shared SmKpiStrip (§3 consolidation) */}
        <SmKpiStrip kpis={kpis} />

        {/* Table — shared DataTable (sticky header, sorting, soft-chip status colours) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
          <LocationsTable rows={paged} selectedId={selected?.id}
            onSelect={loc => setSelected(prev => prev?.id === loc.id ? null : loc)} />
        </div>

        <PaginationBar page={page} totalPages={totalPages} totalRows={filtered.length} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <LocationDrawer loc={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
