import { useState, useEffect, useMemo } from 'react'
import { Search, Mail, Phone, MessageCircle, Building2 } from 'lucide-react'
import api                    from '../../lib/api'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import ContactPersonDrawer    from './ContactPersonDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'


export default function ContactPersonsTable() {
  const [contacts, setContacts]   = useState([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [drill,    setDrill]      = useState(null)
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [selectedReceives,  setSelectedReceives]  = useState([])

  const { registerFilters, unregisterFilters } = useRightPanel()
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth()
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        const customers = res.data?.data ?? res.data ?? []
        const flat = customers.flatMap(customer =>
          (customer.contacts ?? []).map(contact => ({
            ...contact,
            customer_name:  customer.name,
            customer_id:    customer.id,
            location_count: customer.locations?.length ?? 0,
          }))
        )
        setContacts(flat)
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [])

  const customerOptions = useMemo(() =>
    [...new Set(contacts.map(c => c.customer_name).filter(Boolean))].sort(),
    [contacts]
  )

  const filtered = useMemo(() => {
    let rows = contacts
    if (selectedCustomers.length > 0)
      rows = rows.filter(c => selectedCustomers.includes(c.customer_name))
    if (selectedReceives.length > 0) {
      rows = rows.filter(c => selectedReceives.includes(Boolean(c.scheduled_order_contact) ? 'ja' : 'nee'))
    }
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(c => {
        const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ')
        return (
          fullName.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.mobile ?? '').toLowerCase().includes(q) ||
          (c.customer_name ?? '').toLowerCase().includes(q)
        )
      })
    }
    return rows
  }, [contacts, selectedCustomers, selectedReceives, search])

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged      = useMemo(() => filtered.slice((page-1)*pageSize, page*pageSize), [filtered, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const handlePageSizeChange = async (n) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser() } catch {}
  }

  const filterGroups = useMemo(() => {
    const groups = []
    if (customerOptions.length > 0) {
      groups.push({
        key: 'klant', label: 'Klant', type: 'search-select',
        selected: selectedCustomers,
        options: customerOptions.map(c => ({
          value: c, label: c,
          count: contacts.filter(x => x.customer_name === c).length,
        })),
        onToggle: v => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    groups.push({
      key: 'berichten', label: 'Planningscontact',
      selected: selectedReceives,
      options: [
        { value: 'ja',  label: 'Planningscontact',     count: contacts.filter(c => Boolean(c.scheduled_order_contact)).length },
        { value: 'nee', label: 'Geen planningscontact', count: contacts.filter(c => !Boolean(c.scheduled_order_contact)).length },
      ],
      onToggle: v => setSelectedReceives(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    })
    return groups
  }, [customerOptions, selectedCustomers, selectedReceives, contacts])

  useEffect(() => {
    registerFilters('contact-persons', filterGroups)
    return () => unregisterFilters('contact-persons')
  }, [filterGroups, registerFilters, unregisterFilters])

  const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
               color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
               whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const TD = { padding: '10px 14px', borderBottom: '1px solid #F9FAFB', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
            Contactpersonen
          </h2>
          {!loading && (
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {filtered.length} van {contacts.length} contactpersonen
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                      background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, width: 260 }}>
          <Search size={13} color="#9CA3AF" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op naam, e-mail, locatie…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                     fontSize: 12, color: '#374151' }} />
        </div>
      </div>

      {/* Tabel */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F3F4F6', overflow: 'hidden', flex: 1 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TH}>Klant</th>
                <th style={TH}>Naam</th>
                <th style={TH}>E-mail</th>
                <th style={TH}>Telefoon</th>
                <th style={TH}>Planningscontact</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Contactpersonen ophalen…
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Geen contactpersonen gevonden
                </td></tr>
              )}
              {!loading && paged.map((c, i) => {
                const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ')
                const name     = fullName || '—'
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const isPlanning = Boolean(c.scheduled_order_contact)

                return (
                  <tr key={c.id ?? i}
                    style={{ transition: 'background 0.1s', cursor: 'pointer' }}
                    onClick={() => setDrill(c)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {/* Klant — eerste kolom */}
                    <td style={{ ...TD, minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={12} color="#9CA3AF" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: '#374151' }}>
                          {c.customer_name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Naam */}
                    <td style={{ ...TD, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 10, fontWeight: 600 }}>
                          {initials || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827' }}>{name}</div>
                          {c.function_title && (
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.function_title}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* E-mail */}
                    <td style={{ ...TD, minWidth: 180 }}>
                      {c.email
                        ? <a href={`mailto:${c.email}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 5,
                                     color: '#2563EB', textDecoration: 'none', fontSize: 12 }}>
                            <Mail size={11} />{c.email}
                          </a>
                        : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Telefoon */}
                    <td style={{ ...TD, minWidth: 130 }}>
                      {c.mobile
                        ? <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151' }}>
                            <Phone size={11} color="#9CA3AF" />{c.mobile}
                          </div>
                        : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Planningscontact */}
                    <td style={TD}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                        background: isPlanning ? '#F0FDF4' : '#F9FAFB',
                        color:      isPlanning ? '#16A34A'  : '#9CA3AF',
                        border:     `1px solid ${isPlanning ? '#BBF7D0' : '#E5E7EB'}`,
                      }}>
                        {isPlanning
                          ? <><MessageCircle size={10} /> Ja</>
                          : <><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D1D5DB' }} /> Nee</>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={filtered.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {drill && <ContactPersonDrawer contact={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
