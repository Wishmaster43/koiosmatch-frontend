import { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, MapPin, Building2, Users } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { ac, Avatar, StatusBadge } from './departmentParts'
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
  const [selStatuses,  setSelStatuses]  = useState<string[]>([])
  const [selCustomers,   setSelCustomers]   = useState<string[]>([])
  const [selLocations,  setSelLocations]  = useState<string[]>([])
  const pageSize = 12

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

  const headers = [
    t('departmentsPage.cols.department'), t('departmentsPage.cols.customer'), t('departmentsPage.cols.location'),
    t('departmentsPage.cols.employees'), t('departmentsPage.cols.shifts'), t('departmentsPage.cols.status'),
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

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {headers.map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((dep, i) => {
                  const isSel = selected?.id === dep.id
                  return (
                    <tr key={dep.id} onClick={() => setSelected(isSel ? null : dep)}
                      style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isSel ? 'var(--color-primary-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar label={dep.name} size={28} radius={6} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{dep.name}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, background: ac(dep.customer),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
                            {dep.customer?.charAt(0)}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 160,
                            overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.customer}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 200,
                            overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.location}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Users size={12} color="var(--text-muted)" />
                          <span style={{ fontSize: 13, fontWeight: (dep.employees ?? 0) > 0 ? 600 : 400,
                            color: (dep.employees ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{dep.employees}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: (dep.shifts ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)',
                          fontWeight: (dep.shifts ?? 0) > 0 ? 600 : 400 }}>{dep.shifts}</span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={dep.status} />
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 13 }}>{t('departmentsPage.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{t('departmentsPage.count', { count: filtered.length })}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page > 1 ? 'pointer' : 'default',
                    color: page > 1 ? 'var(--text)' : 'var(--text-muted)', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: page < totalPages ? 'pointer' : 'default',
                    color: page < totalPages ? 'var(--text)' : 'var(--text-muted)', fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DepartmentDrawer dep={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
