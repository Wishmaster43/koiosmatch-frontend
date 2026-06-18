import { useState, useMemo, useEffect } from 'react'
import { Search, Mail, Phone, MessageCircle, Building2, MapPin, X, ChevronRight } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'

const DUMMY = [
  { id: 1,  firstname: 'Sophie',  lastname: 'van den Berg',  function_title: 'HR Manager',           customer: 'Stichting Rivas Zorggroep',    location: 'Rivas Zorggroep — Papendrecht',        email: 'sophie.vandenberg@rivas.nl',      mobile: '06-12345678', planning: true  },
  { id: 2,  firstname: 'Mark',    lastname: 'de Vries',      function_title: 'Hoofd Planning',        customer: 'Stichting Rivas Zorggroep',    location: 'Rivas Zorggroep — Gorinchem',           email: 'mark.devries@rivas.nl',           mobile: '06-23456789', planning: true  },
  { id: 3,  firstname: 'Lisa',    lastname: 'Jansen',        function_title: 'Recruiter',             customer: 'Stichting Rivas Zorggroep',    location: 'Rivas Zorggroep — Papendrecht',        email: 'lisa.jansen@rivas.nl',            mobile: '06-34567890', planning: false },
  { id: 4,  firstname: 'Tom',     lastname: 'Bakker',        function_title: 'Vestigingsmanager',     customer: 'Yesway zorg',                  location: 'Yesway — Rotterdam Zuid',              email: 'tom.bakker@yesway.nu',            mobile: '06-45678901', planning: true  },
  { id: 5,  firstname: 'Nora',    lastname: 'Smits',         function_title: 'HR Adviseur',           customer: 'Yesway zorg',                  location: 'Yesway — Den Haag Centrum',            email: 'nora.smits@yesway.nu',            mobile: '06-56789012', planning: false },
  { id: 6,  firstname: 'Daan',    lastname: 'Visser',        function_title: 'Planningscoördinator',  customer: 'Yesway zorg',                  location: 'Yesway — Dordrecht',                   email: 'daan.visser@yesway.nu',           mobile: '06-67890123', planning: true  },
  { id: 7,  firstname: 'Emma',    lastname: 'Hoekstra',      function_title: 'Office Manager',        customer: 'Yesway works',                 location: 'Yesway — Utrecht',                     email: 'emma.hoekstra@yesway.nu',         mobile: '06-78901234', planning: true  },
  { id: 8,  firstname: 'Lars',    lastname: 'Meijer',        function_title: 'HR Manager',            customer: 'Yesway works',                 location: 'Yesway — Amsterdam Noord',             email: 'lars.meijer@yesway.nu',           mobile: '06-89012345', planning: false },
  { id: 9,  firstname: 'Ines',    lastname: 'Lanting',       function_title: 'Coördinator',           customer: 'Stichting WoonzorgGroep Samen',location: 'WoonzorgGroep Samen — Anna Paulowna',  email: 'i.lanting@woonzorggroepsamen.nl', mobile: '06-90123456', planning: true  },
  { id: 10, firstname: 'Pieter',  lastname: 'Kooijman',      function_title: 'Recruiter',             customer: 'UMC Utrecht',                  location: 'UMC Utrecht — Oncologie',              email: 'p.kooijman@umcutrecht.nl',        mobile: '06-01234567', planning: false },
  { id: 11, firstname: 'Myrthe',  lastname: 'van Dijk',      function_title: 'HR Business Partner',   customer: 'UMC Utrecht',                  location: 'UMC Utrecht — Oncologie',              email: 'm.vandijk@umcutrecht.nl',         mobile: '06-11223344', planning: true  },
  { id: 12, firstname: 'Joost',   lastname: 'Hendriksen',    function_title: 'Planningsmanager',      customer: 'Den Haag Zorginstellingen',    location: 'Den Haag Zorginstellingen — Centrum',  email: 'j.hendriksen@dhzi.nl',            mobile: '06-22334455', planning: true  },
  { id: 13, firstname: 'Fleur',   lastname: 'van Amstel',    function_title: 'HR Coördinator',        customer: 'Den Haag Zorginstellingen',    location: 'Den Haag Zorginstellingen — Centrum',  email: 'f.vanamstel@dhzi.nl',             mobile: '06-33445566', planning: false },
]

const COLORS = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6']
function ac(s) { return COLORS[(s || '?').charCodeAt(0) % COLORS.length] }

function ContactDrawer({ contact, onClose }) {
  if (!contact) return null
  const name     = [contact.firstname, contact.lastname].filter(Boolean).join(' ')
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Contactpersoon</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: ac(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff' }}>{initials}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.function_title}</div>
            {contact.planning && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6,
                padding: '2px 8px', borderRadius: 999, background: '#F0FDF4', color: 'var(--color-success)',
                border: '1px solid #BBF7D0', fontWeight: 500 }}>
                <MessageCircle size={10} /> Planningscontact
              </span>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Contactgegevens</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                <Mail size={13} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>E-mail</div>
                <a href={`mailto:${contact.email}`} style={{ fontSize: 13, color: 'var(--color-secondary)', textDecoration: 'none' }}>{contact.email}</a>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                <Phone size={13} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Telefoon</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{contact.mobile}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Klant */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Klant</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: ac(contact.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {contact.customer?.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{contact.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gekoppelde klant</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Locatie */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>Locatie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={14} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{contact.location}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Werklocatie</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [selKlanten,  setSelKlanten]  = useState([])
  const [selPlanning, setSelPlanning] = useState([])
  const pageSize = 12

  const { registerFilters, unregisterFilters } = useRightPanel()

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const klantOptions = useMemo(() => [...new Set(DUMMY.map(c => c.customer))].sort(), [])

  const filterGroups = useMemo(() => [
    { key: 'klant', label: 'Klant',
      options: klantOptions.map(k => ({ value: k, label: k, count: DUMMY.filter(c => c.customer === k).length })),
      selected: selKlanten, onToggle: toggle(setSelKlanten) },
    { key: 'planning', label: 'Planningscontact',
      options: [
        { value: 'ja',  label: 'Planningscontact',      count: DUMMY.filter(c => c.planning).length },
        { value: 'nee', label: 'Geen planningscontact', count: DUMMY.filter(c => !c.planning).length },
      ],
      selected: selPlanning, onToggle: toggle(setSelPlanning) },
  ], [klantOptions, selKlanten, selPlanning])

  useEffect(() => {
    registerFilters('klanten-contacts', filterGroups)
    return () => unregisterFilters('klanten-contacts')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = DUMMY
    if (selKlanten.length)  rows = rows.filter(c => selKlanten.includes(c.customer))
    if (selPlanning.length) rows = rows.filter(c => selPlanning.includes(c.planning ? 'ja' : 'nee'))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(c => {
        const n = [c.firstname, c.lastname].join(' ').toLowerCase()
        return n.includes(q) || c.customer.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      })
    }
    return rows
  }, [search, selKlanten, selPlanning])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paged      = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 16, flexShrink: 0 }}>
          {[
            { label: 'Contactpersonen', value: DUMMY.length },
            { label: 'Planningscontact', value: DUMMY.filter(c => c.planning).length },
            { label: 'Klanten', value: klantOptions.length },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px', flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Naam','Klant','Locatie','E-mail','Telefoon','Planningscontact'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const name     = [c.firstname, c.lastname].filter(Boolean).join(' ')
                  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  const isSel    = selected?.id === c.id
                  return (
                    <tr key={c.id} onClick={() => setSelected(isSel ? null : c)}
                      style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isSel ? 'var(--color-primary-bg)' : 'transparent' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>

                      {/* Naam */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: ac(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
                            {c.function_title && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.function_title}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Klant */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, background: ac(c.customer),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                            {c.customer?.charAt(0)}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text)', maxWidth: 140,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer}</span>
                        </div>
                      </td>

                      {/* Locatie */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text)', maxWidth: 160,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.location}</span>
                        </div>
                      </td>

                      {/* E-mail */}
                      <td style={{ padding: '11px 14px' }}>
                        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={11} />{c.email}
                        </a>
                      </td>

                      {/* Telefoon */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text)' }}>
                          <Phone size={11} color="var(--text-muted)" />{c.mobile}
                        </div>
                      </td>

                      {/* Planningscontact */}
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 999,
                          background: c.planning ? '#F0FDF4' : '#F9FAFB',
                          color:      c.planning ? 'var(--color-success)'  : '#9CA3AF',
                          border:     `1px solid ${c.planning ? '#BBF7D0' : '#E5E7EB'}` }}>
                          {c.planning ? <><MessageCircle size={10} /> Ja</> : 'Nee'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 13 }}>Geen contactpersonen gevonden</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{filtered.length} contactpersonen</span>
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

      <ContactDrawer contact={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
