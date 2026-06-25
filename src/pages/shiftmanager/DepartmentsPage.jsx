import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, MapPin, Building2, Users } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import api, { unwrapList } from '../../lib/api'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'
import { ac, Avatar, StatusBadge } from './departmentParts'
import DepartmentDrawer from './DepartmentDrawer'

// ── Dummy fallback data (only rendered under USE_MOCKS) ───────────────────────
const DUMMY = [
  { id: 1,  name: 'Verpleging',           customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Papendrecht', city: 'Papendrecht', status: 'Actief',   employees: 24, shifts: 18 },
  { id: 2,  name: 'PG-afdeling',          customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Papendrecht', city: 'Papendrecht', status: 'Actief',   employees: 16, shifts: 12 },
  { id: 3,  name: 'Revalidatie',          customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Papendrecht', city: 'Papendrecht', status: 'Actief',   employees: 9,  shifts: 7  },
  { id: 4,  name: 'Dagbesteding',         customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Gorinchem',  city: 'Gorinchem',   status: 'Actief',   employees: 11, shifts: 9  },
  { id: 5,  name: 'Somatiek',             customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Gorinchem',  city: 'Gorinchem',   status: 'Actief',   employees: 8,  shifts: 6  },
  { id: 6,  name: 'PG-zorg',              customer: 'Yesway zorg',               location: 'Yesway — Rotterdam Zuid',      city: 'Rotterdam',   status: 'Actief',   employees: 31, shifts: 25 },
  { id: 7,  name: 'Avond & Nacht',        customer: 'Yesway zorg',               location: 'Yesway — Rotterdam Zuid',      city: 'Rotterdam',   status: 'Actief',   employees: 14, shifts: 11 },
  { id: 8,  name: 'LVB',                  customer: 'Yesway zorg',               location: 'Yesway — Den Haag Centrum',    city: 'Den Haag',    status: 'Actief',   employees: 19, shifts: 14 },
  { id: 9,  name: 'Somatiek',             customer: 'Yesway zorg',               location: 'Yesway — Den Haag Centrum',    city: 'Den Haag',    status: 'Actief',   employees: 12, shifts: 9  },
  { id: 10, name: 'Begeleiding',          customer: 'Yesway zorg',               location: 'Yesway — Den Haag Centrum',    city: 'Den Haag',    status: 'Actief',   employees: 7,  shifts: 5  },
  { id: 11, name: 'Kleinschalig wonen',   customer: 'Yesway works',              location: 'Yesway — Utrecht',             city: 'Utrecht',     status: 'Actief',   employees: 6,  shifts: 4  },
  { id: 12, name: 'Verpleging',           customer: 'Stichting WoonzorgGroep Samen', location: 'WoonzorgGroep Samen — Anna Paulowna', city: 'Anna Paulowna', status: 'Actief', employees: 13, shifts: 10 },
  { id: 13, name: 'Dagopvang',            customer: 'Stichting WoonzorgGroep Samen', location: 'WoonzorgGroep Samen — Anna Paulowna', city: 'Anna Paulowna', status: 'Inactief', employees: 0, shifts: 0 },
  { id: 14, name: 'Oncologie',            customer: 'UMC Utrecht',               location: 'UMC Utrecht — Oncologie',      city: 'Utrecht',     status: 'Actief',   employees: 8,  shifts: 6  },
  { id: 15, name: 'Verpleging',           customer: 'UMC Utrecht',               location: 'UMC Utrecht — Oncologie',      city: 'Utrecht',     status: 'Actief',   employees: 5,  shifts: 3  },
  { id: 16, name: 'Verpleging',           customer: 'Den Haag Zorginstellingen', location: 'Den Haag Zorginstellingen — Centrum', city: 'Den Haag', status: 'Actief', employees: 10, shifts: 8 },
  { id: 17, name: 'Revalidatie',          customer: 'Den Haag Zorginstellingen', location: 'Den Haag Zorginstellingen — Centrum', city: 'Den Haag', status: 'Actief', employees: 6,  shifts: 4 },
  { id: 18, name: 'PG-zorg',             customer: 'Yesway zorg',               location: 'Yesway — Dordrecht',           city: 'Dordrecht',   status: 'Actief',   employees: 17, shifts: 13 },
  { id: 19, name: 'Begeleiding',          customer: 'Yesway zorg',               location: 'Yesway — Dordrecht',           city: 'Dordrecht',   status: 'Actief',   employees: 9,  shifts: 7  },
  { id: 20, name: 'LVB',                  customer: 'Yesway works',              location: 'Yesway — Amsterdam Noord',     city: 'Amsterdam',   status: 'Actief',   employees: 11, shifts: 9  },
  { id: 21, name: 'Kleinschalig wonen',   customer: 'Yesway works',              location: 'Yesway — Amsterdam Noord',     city: 'Amsterdam',   status: 'Actief',   employees: 7,  shifts: 5  },
  { id: 22, name: 'Somatiek',             customer: 'Stichting Rivas Zorggroep', location: 'Rivas Zorggroep — Sliedrecht', city: 'Sliedrecht',  status: 'Actief',   employees: 5,  shifts: 3  },
]

export default function DepartmentsPage() {
  const { t } = useTranslation('shiftmanager')
  const [departments, setDepartments] = useState(USE_MOCKS ? DUMMY : [])
  const [search]                      = useState('')
  const [selected,    setSelected]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [selStatuses,  setSelStatuses]  = useState([])
  const [selCustomers,   setSelCustomers]   = useState([])
  const [selLocations,  setSelLocations]  = useState([])
  const pageSize = 12

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Load departments directly from /sm_departments. Dummy only in mock mode — a
  // failed/empty call shows an empty list in prod.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_departments', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList(res)
        const mapped = rows.map(d => ({
          id:         d.id,
          name:       d.name ?? '',
          customer:   d.customer?.name ?? d.customer ?? '',
          location:   d.location?.name ?? d.location ?? '',
          city:       d.city ?? '',
          costCenter: d.cost_center ?? '',
          status:     d.status === 'active' ? 'Actief' : d.status === 'inactive' ? 'Inactief' : (d.status ?? 'Actief'),
          employees:  d.employee_count ?? 0,
          shifts:     d.shift_count ?? 0,
        }))
        if (mapped.length > 0) setDepartments(mapped)
        else if (!USE_MOCKS) setDepartments([])
      })
      .catch(err => { if (!isAbortError(err) && !USE_MOCKS) setDepartments([]) })
    return () => ctrl.abort()
  }, [])

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions  = useMemo(() => [...new Set(departments.map(d => d.status).filter(Boolean))].sort(), [departments])
  const customerOptions   = useMemo(() => [...new Set(departments.map(d => d.customer).filter(Boolean))].sort(), [departments])
  const locationOptions = useMemo(() => [...new Set(departments.map(d => d.location).filter(Boolean))].sort(), [departments])

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
    if (selStatuses.length)  rows = rows.filter(d => selStatuses.includes(d.status))
    if (selCustomers.length)   rows = rows.filter(d => selCustomers.includes(d.customer))
    if (selLocations.length)  rows = rows.filter(d => selLocations.includes(d.location))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.customer.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
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
    { label: t('departmentsPage.kpi.employees'),       value: departments.reduce((s,d) => s + d.employees, 0),          color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)',   Icon: Users },
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
                          <span style={{ fontSize: 13, fontWeight: dep.employees > 0 ? 600 : 400,
                            color: dep.employees > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{dep.employees}</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: dep.shifts > 0 ? 'var(--text)' : 'var(--text-muted)',
                          fontWeight: dep.shifts > 0 ? 600 : 400 }}>{dep.shifts}</span>
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
