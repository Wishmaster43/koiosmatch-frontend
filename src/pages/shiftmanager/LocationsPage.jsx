import { useState, useMemo, useEffect } from 'react'
import { Search, MapPin, Building2, Layers, X, Phone, Mail, ChevronRight, Plus } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import api, { unwrapList } from '../../lib/api'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'

// ── Dummy fallback data ───────────────────────────────────────────────────────
const DUMMY = [
  { id: 1, name: 'Rivas Zorggroep — Papendrecht',     customer: 'Stichting Rivas Zorggroep', city: 'Papendrecht', address: 'Burgemeester Keijzerweg 35', phone: '078 644 1234', email: 'papendrecht@rivas.nl', status: 'Actief',   departments: ['Verpleging', 'PG-afdeling', 'Revalidatie'], shifts: 42 },
  { id: 2, name: 'Rivas Zorggroep — Gorinchem',       customer: 'Stichting Rivas Zorggroep', city: 'Gorinchem',   address: 'Banneweg 30',               phone: '0183 68 1234',  email: 'gorinchem@rivas.nl',   status: 'Actief',   departments: ['Dagbesteding', 'Somatiek'],                  shifts: 28 },
  { id: 3, name: 'Yesway — Rotterdam Zuid',           customer: 'Yesway zorg',               city: 'Rotterdam',   address: 'Spinozaweg 100',            phone: '010 412 5678',  email: 'rotterdam@yesway.nu',  status: 'Actief',   departments: ['PG-zorg', 'Avond & Nacht'],                 shifts: 67 },
  { id: 4, name: 'Yesway — Den Haag Centrum',         customer: 'Yesway zorg',               city: 'Den Haag',    address: 'Prinsegracht 45',           phone: '070 361 2345',  email: 'denhaag@yesway.nu',    status: 'Actief',   departments: ['LVB', 'Somatiek', 'Begeleiding'],            shifts: 53 },
  { id: 5, name: 'Yesway — Utrecht',                  customer: 'Yesway works',              city: 'Utrecht',     address: 'Oudenoord 330',             phone: '030 231 9876',  email: 'utrecht@yesway.nu',    status: 'Actief',   departments: ['Kleinschalig wonen'],                        shifts: 19 },
  { id: 6, name: 'WoonzorgGroep Samen — Anna Paulowna', customer: 'Stichting WoonzorgGroep Samen', city: 'Anna Paulowna', address: 'Keizersweg 1',     phone: '0224 21 3456',  email: 'info@woonzorggroepsamen.nl', status: 'Actief', departments: ['Verpleging', 'Dagopvang'],                  shifts: 31 },
  { id: 7, name: 'UMC Utrecht — Oncologie',           customer: 'UMC Utrecht',               city: 'Utrecht',     address: 'Heidelberglaan 100',        phone: '088 755 0000',  email: 'oncologie@umcutrecht.nl',   status: 'Actief', departments: ['Oncologie', 'Verpleging'],                  shifts: 14 },
  { id: 8, name: 'Den Haag Zorginstellingen — Laak',  customer: 'Den Haag Zorginstellingen', city: 'Den Haag',    address: 'Escamplaan 892',            phone: '070 345 6789',  email: 'laak@dhzi.nl',         status: 'Inactief', departments: [],                                            shifts: 0  },
  { id: 9, name: 'Rivas Zorggroep — Sliedrecht',      customer: 'Stichting Rivas Zorggroep', city: 'Sliedrecht',  address: 'Rivierweg 12',              phone: '0184 41 2222',  email: 'sliedrecht@rivas.nl',  status: 'Actief',   departments: ['Somatiek'],                                  shifts: 9  },
  { id: 10, name: 'Yesway — Dordrecht',               customer: 'Yesway zorg',               city: 'Dordrecht',   address: 'Noordendijk 250',           phone: '078 613 4567',  email: 'dordrecht@yesway.nu',  status: 'Actief',   departments: ['PG-zorg', 'Begeleiding'],                    shifts: 38 },
  { id: 11, name: 'Yesway — Amsterdam Noord',         customer: 'Yesway works',              city: 'Amsterdam',   address: 'Buikslotermeerplein 12',    phone: '020 636 5678',  email: 'amsterdam@yesway.nu',  status: 'Actief',   departments: ['LVB', 'Kleinschalig wonen'],                 shifts: 22 },
  { id: 12, name: 'Den Haag Zorginstellingen — Centrum', customer: 'Den Haag Zorginstellingen', city: 'Den Haag', address: 'Lutherse Burgwal 10',       phone: '070 356 1234',  email: 'centrum@dhzi.nl',      status: 'Actief',   departments: ['Verpleging', 'Revalidatie'],                 shifts: 17 },
]

const AVATAR_COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6']
function ac(s) { return AVATAR_COLORS[(s || '?').charCodeAt(0) % AVATAR_COLORS.length] }

function Avatar({ label, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: ac(label), display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700 }}>
      {(label || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function StatusBadge({ status }) {
  const active = status?.toLowerCase() === 'actief' || status?.toLowerCase() === 'active'
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
      background: active ? 'var(--color-success-bg)' : '#F3F4F6',
      color:      active ? 'var(--color-success)' : '#6B7280', whiteSpace: 'nowrap' }}>
      {status || 'Onbekend'}
    </span>
  )
}

// ── Drill-down drawer ─────────────────────────────────────────────────────────
function LocationDrawer({ loc, onClose }) {
  if (!loc) return null
  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Locatie</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <Avatar label={loc.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{loc.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loc.customer}</span>
            </div>
          </div>
          <StatusBadge status={loc.status} />
        </div>

        {/* Klant koppeling */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Klant</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(loc.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {loc.customer?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{loc.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gekoppelde klant</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Contact details */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Contactgegevens</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                <MapPin size={14} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adres</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.address}, {loc.city}</div>
              </div>
            </div>
            {loc.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Phone size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Telefoon</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.phone}</div>
                </div>
              </div>
            )}
            {loc.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Mail size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>E-mail</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.email}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Afdelingen', value: loc.departments.length, icon: Layers, color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            { label: 'Actieve diensten', value: loc.shifts, icon: Building2, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Afdelingen */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Afdelingen</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--hover-bg)',
                padding: '1px 7px', borderRadius: 999 }}>{loc.departments.length}</span>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Plus size={12} /> Toevoegen
            </button>
          </div>
          {loc.departments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loc.departments.map((dep, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--hover-bg)'}>
                  <Layers size={13} color="var(--text-muted)" />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{dep}</span>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
              background: 'var(--hover-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
              Geen afdelingen gekoppeld
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 500,
          borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
          color: 'var(--color-primary)', cursor: 'pointer' }}>
          Locatie bewerken
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LocationsPage() {
  const [locations, setLocations] = useState(USE_MOCKS ? DUMMY : [])
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(null)
  const [page,      setPage]      = useState(1)
  const [selStatuses,  setSelStatuses]  = useState([])
  const [selKlanten,   setSelKlanten]   = useState([])
  const [selSteden,    setSelSteden]    = useState([])
  const pageSize = 10

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Load locations (derived from /sm/customers). Dummy only in mock mode — a
  // failed/empty call shows an empty list in prod, never fabricated rows.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm/customers', { signal: ctrl.signal })
      .then(res => {
        const { rows: customers } = unwrapList(res)
        const flat = customers.flatMap(c =>
          (c.locations ?? []).map(l => ({
            id:          l.id,
            name:        l.name,
            customer:    c.name,
            city:        l.city ?? '',
            address:     l.address ?? '',
            phone:       l.phone ?? '',
            email:       l.email ?? '',
            status:      l.status === 'active' ? 'Actief' : l.status === 'inactive' ? 'Inactief' : (l.status ?? 'Actief'),
            departments: (l.departments ?? []).map(d => d.name ?? d),
            shifts:      l.shift_count ?? 0,
          }))
        )
        if (flat.length > 0) setLocations(flat)
        else if (!USE_MOCKS) setLocations([])
      })
      .catch(err => { if (!isAbortError(err) && !USE_MOCKS) setLocations([]) })
    return () => ctrl.abort()
  }, [])

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const statusOptions = useMemo(() => [...new Set(locations.map(l => l.status).filter(Boolean))].sort(), [locations])
  const klantOptions  = useMemo(() => [...new Set(locations.map(l => l.customer).filter(Boolean))].sort(), [locations])
  const stadsOptions  = useMemo(() => [...new Set(locations.map(l => l.city).filter(Boolean))].sort(), [locations])

  const filterGroups = useMemo(() => [
    { key: 'status',  label: 'Status',
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selStatuses,  onToggle: toggle(setSelStatuses) },
    { key: 'klant',   label: 'Klant',
      options: klantOptions.map(k => ({ value: k, label: k })),
      selected: selKlanten,   onToggle: toggle(setSelKlanten) },
    { key: 'stad',    label: 'Stad',
      options: stadsOptions.map(s => ({ value: s, label: s })),
      selected: selSteden,    onToggle: toggle(setSelSteden) },
  ], [statusOptions, klantOptions, stadsOptions, selStatuses, selKlanten, selSteden])

  useEffect(() => {
    registerFilters('locations-page', filterGroups)
    return () => unregisterFilters('locations-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = locations
    if (selStatuses.length) rows = rows.filter(l => selStatuses.includes(l.status))
    if (selKlanten.length)  rows = rows.filter(l => selKlanten.includes(l.customer))
    if (selSteden.length)   rows = rows.filter(l => selSteden.includes(l.city))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q)
      )
    }
    return rows
  }, [locations, search, selStatuses, selKlanten, selSteden])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'Totaal locaties',  value: locations.length,                                    color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: MapPin },
            { label: 'Actief',           value: locations.filter(l => l.status === 'Actief').length, color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: Building2 },
            { label: 'Afdelingen',       value: locations.reduce((s,l) => s + l.departments.length, 0), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: Layers },
            { label: 'Gekoppelde klanten', value: [...new Set(locations.map(l => l.customer))].length,  color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Building2 },
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
                  {['Locatie','Klant','Stad','Afdelingen','Diensten','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((loc, i) => {
                  const isSel = selected?.id === loc.id
                  return (
                    <tr key={loc.id} onClick={() => setSelected(isSel ? null : loc)}
                      style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isSel ? 'var(--color-primary-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>

                      {/* Locatie */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar label={loc.name} size={30} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{loc.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loc.address}</div>
                          </div>
                        </div>
                      </td>

                      {/* Klant */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 5, background: ac(loc.customer),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                            {loc.customer?.charAt(0)}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{loc.customer}</span>
                        </div>
                      </td>

                      {/* Stad */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={12} color="var(--text-muted)" />
                          <span style={{ fontSize: 13, color: 'var(--text)' }}>{loc.city}</span>
                        </div>
                      </td>

                      {/* Afdelingen */}
                      <td style={{ padding: '12px 14px' }}>
                        {loc.departments.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{loc.departments.length}</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {loc.departments.slice(0, 2).map(d => (
                                <span key={d} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                                  background: 'var(--hover-bg)', border: '1px solid var(--border)',
                                  color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d}</span>
                              ))}
                              {loc.departments.length > 2 && (
                                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                                  background: 'var(--hover-bg)', border: '1px solid var(--border)',
                                  color: 'var(--text-muted)' }}>+{loc.departments.length - 2}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Diensten */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: loc.shifts > 0 ? 'var(--text)' : 'var(--text-muted)',
                          fontWeight: loc.shifts > 0 ? 600 : 400 }}>{loc.shifts}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={loc.status} />
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 13 }}>Geen locaties gevonden</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{filtered.length} locaties</span>
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

      <LocationDrawer loc={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
