import { useState, useMemo, useEffect } from 'react'
import { Search, Layers, MapPin, Building2, Users, X, Plus, ChevronRight } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import api from '../../lib/api'

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

const AVATAR_COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6']
function ac(s) { return AVATAR_COLORS[(s || '?').charCodeAt(0) % AVATAR_COLORS.length] }

function Avatar({ label, size = 30, radius = 8 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: ac(label), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700 }}>
      {(label || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function StatusBadge({ status }) {
  const active = status?.toLowerCase() === 'actief'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--color-success-bg)' : '#F3F4F6',
      color:      active ? 'var(--color-success)' : '#6B7280', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function DepartmentDrawer({ dep, onClose }) {
  if (!dep) return null
  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Afdeling</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <Avatar label={dep.name} size={52} radius={10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{dep.name}</div>
            <StatusBadge status={dep.status} />
          </div>
        </div>

        {/* Klant */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Klant</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(dep.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {dep.customer?.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dep.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gekoppelde klant</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Locatie */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Locatie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={16} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dep.location}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dep.city}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Medewerkers', value: dep.employees, Icon: Users,    color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            { label: 'Diensten',    value: dep.shifts,    Icon: Layers,   color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.Icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Notities leeg */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Notities</div>
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            background: 'var(--hover-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
            Nog geen notities
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button style={{ width: '100%', padding: 9, fontSize: 13, fontWeight: 500,
          borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
          color: 'var(--color-primary)', cursor: 'pointer' }}>
          Afdeling bewerken
        </button>
      </div>
    </div>
  )
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState(DUMMY)
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [selStatuses,  setSelStatuses]  = useState([])
  const [selKlanten,   setSelKlanten]   = useState([])
  const [selLocaties,  setSelLocaties]  = useState([])
  const pageSize = 12

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/sm/customers')
      .then(res => {
        const customers = res.data?.data ?? res.data ?? []
        const flat = customers.flatMap(c =>
          (c.locations ?? []).flatMap(loc =>
            (loc.departments ?? []).map(d => ({
              id:        d.id,
              name:      d.name,
              customer:  c.name,
              location:  loc.name,
              city:      loc.city ?? '',
              status:    d.status === 'active' ? 'Actief' : d.status === 'inactive' ? 'Inactief' : (d.status ?? 'Actief'),
              employees: d.employee_count ?? 0,
              shifts:    d.shift_count ?? 0,
            }))
          )
        )
        if (flat.length > 0) setDepartments(flat)
      })
      .catch(() => {})
  }, [])

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions  = useMemo(() => [...new Set(departments.map(d => d.status).filter(Boolean))].sort(), [departments])
  const klantOptions   = useMemo(() => [...new Set(departments.map(d => d.customer).filter(Boolean))].sort(), [departments])
  const locatieOptions = useMemo(() => [...new Set(departments.map(d => d.location).filter(Boolean))].sort(), [departments])

  const filterGroups = useMemo(() => [
    { key: 'status',  label: 'Status',
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: toggle(setSelStatuses) },
    { key: 'klant',   label: 'Klant',
      options: klantOptions.map(k => ({ value: k, label: k })),
      selected: selKlanten,   onToggle: toggle(setSelKlanten) },
    { key: 'locatie', label: 'Locatie',
      options: locatieOptions.map(l => ({ value: l, label: l })),
      selected: selLocaties,  onToggle: toggle(setSelLocaties) },
  ], [statusOptions, klantOptions, locatieOptions, selStatuses, selKlanten, selLocaties])

  useEffect(() => {
    registerFilters('departments-page', filterGroups)
    return () => unregisterFilters('departments-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = departments
    if (selStatuses.length)  rows = rows.filter(d => selStatuses.includes(d.status))
    if (selKlanten.length)   rows = rows.filter(d => selKlanten.includes(d.customer))
    if (selLocaties.length)  rows = rows.filter(d => selLocaties.includes(d.location))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.customer.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      )
    }
    return rows
  }, [departments, search, selStatuses, selKlanten, selLocaties])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'Totaal afdelingen',    value: departments.length,                                       color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: Layers },
            { label: 'Actief',               value: departments.filter(d => d.status === 'Actief').length,   color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: Layers },
            { label: 'Medewerkers',          value: departments.reduce((s,d) => s + d.employees, 0),          color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: Users },
            { label: 'Gekoppelde klanten',   value: [...new Set(departments.map(d => d.customer))].length,   color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
          ].map(k => (
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
                  {['Afdeling','Klant','Locatie','Medewerkers','Diensten','Status'].map(h => (
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
                            fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
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
                    color: 'var(--text-muted)', fontSize: 13 }}>Geen afdelingen gevonden</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{filtered.length} afdelingen</span>
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
