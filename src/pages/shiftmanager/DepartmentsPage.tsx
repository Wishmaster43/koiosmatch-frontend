import { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Building2, Users } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import DepartmentsTable from './DepartmentsTable'
import PaginationBar from '@/components/ui/PaginationBar'
import DepartmentDrawer from './DepartmentDrawer'
import { useSmDepartments } from './hooks/useSmDepartments'
import type { SmDepartmentRow } from '@/types/shiftmanager'

export default function DepartmentsPage() {
  const { t } = useTranslation('shiftmanager')
  // Data (fetch + transform) lives in the shared hook (§3).
  const { departments } = useSmDepartments()
  const [search]                      = useState('')
  const [selected,    setSelected]    = useState<SmDepartmentRow | null>(null)
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(50)
  const [selStatuses,  setSelStatuses]  = useState<string[]>([])
  const [selCustomers,   setSelCustomers]   = useState<string[]>([])
  const [selLocations,  setSelLocations]  = useState<string[]>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions  = useMemo(() => [...new Set(departments.map(d => d.status).filter((x): x is string => Boolean(x)))].sort(), [departments])
  const customerOptions   = useMemo(() => [...new Set(departments.map(d => d.customer).filter((x): x is string => Boolean(x)))].sort(), [departments])
  const locationOptions = useMemo(() => [...new Set(departments.map(d => d.location).filter((x): x is string => Boolean(x)))].sort(), [departments])

  const filterGroups = useMemo(() => [
    { key: 'status',  label: t('departmentsPage.filter.status'),
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: toggle(setSelStatuses) },
    { key: 'klant',   label: t('departmentsPage.filter.customer'),
      options: customerOptions.map(k => ({ value: k, label: k })),
      selected: selCustomers,   onToggle: toggle(setSelCustomers) },
    { key: 'locatie', label: t('departmentsPage.filter.location'),
      options: locationOptions.map(l => ({ value: l, label: l })),
      selected: selLocations,  onToggle: toggle(setSelLocations) },
  ], [t, statusOptions, customerOptions, locationOptions, selStatuses, selCustomers, selLocations])

  useEffect(() => {
    registerFilters('departments-page', filterGroups)
    return () => unregisterFilters('departments-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = departments
    if (selStatuses.length)  rows = rows.filter(d => selStatuses.includes(d.status as string))
    if (selCustomers.length)   rows = rows.filter(d => selCustomers.includes(d.customer as string))
    if (selLocations.length)  rows = rows.filter(d => selLocations.includes(d.location as string))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        (d.name ?? '').toLowerCase().includes(q) ||
        (d.customer ?? '').toLowerCase().includes(q) ||
        (d.location ?? '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [departments, search, selStatuses, selCustomers, selLocations])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  // KPI cards — translated labels; values derived from the live list.
  const kpis = [
    { label: t('departmentsPage.kpi.total'),           value: departments.length,                                       color: 'var(--color-primary)',   bg: 'var(--color-primary-bg)',   Icon: Layers },
    { label: t('departmentsPage.kpi.active'),          value: departments.filter(d => d.status === 'Actief').length,    color: 'var(--color-success)',   bg: 'var(--color-success-bg)',   Icon: Layers },
    { label: t('departmentsPage.kpi.employees'),       value: departments.reduce((s,d) => s + (d.employees ?? 0), 0),   color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)',   Icon: Users },
    { label: t('departmentsPage.kpi.linkedCustomers'), value: [...new Set(departments.map(d => d.customer))].length,    color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 20, flexShrink: 0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: k.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.Icon size={15} color={k.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table — shared DataTable (sticky header, sorting, soft-chip status colours) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
          <DepartmentsTable rows={paged} selectedId={selected?.id}
            onSelect={dep => setSelected(prev => prev?.id === dep.id ? null : dep)} />
        </div>

        <PaginationBar page={page} totalPages={totalPages} totalRows={filtered.length} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <DepartmentDrawer dep={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
