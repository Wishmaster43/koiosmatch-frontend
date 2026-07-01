/**
 * ContactPersonsTable — searchable, paginated table of customer contact persons.
 * Each row shows contact details; clicking opens ContactPersonDrawer. Filters
 * come from RightPanelContext, page size from the user's preference.
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Mail, Phone, MessageCircle, Building2 } from 'lucide-react'
import api                    from '@/lib/api'
import { useRightPanel }      from '@/context/RightPanelContext'
import { useAuth }            from '@/context/AuthContext'
import ContactPersonDrawer    from './ContactPersonDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '@/lib/usePageSize'
import type { ReportContact, ReportCustomer, ReportFilterGroup } from '@/types/reports'


export default function ContactPersonsTable() {
  const { t } = useTranslation('reports')
  const [contacts, setContacts]   = useState<ReportContact[]>([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [drill,    setDrill]      = useState<ReportContact | null>(null)
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [selectedReceives,  setSelectedReceives]  = useState<Array<string | number>>([])

  const { registerFilters, unregisterFilters } = useRightPanel()
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    api.get('/sm_customers')
      .then(res => {
        const customers = (res.data?.data ?? res.data ?? []) as ReportCustomer[]
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
    [...new Set(contacts.map(c => c.customer_name).filter((x): x is string => Boolean(x)))].sort(),
    [contacts]
  )

  const filtered = useMemo(() => {
    let rows = contacts
    if (selectedCustomers.length > 0)
      rows = rows.filter(c => selectedCustomers.includes(c.customer_name as string))
    if (selectedReceives.length > 0) {
      rows = rows.filter(c => selectedReceives.includes(c.scheduled_order_contact ? 'ja' : 'nee'))
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

  const handlePageSizeChange = async (n: number) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser?.() } catch { /* noop */ }
  }

  const filterGroups = useMemo(() => {
    const groups: ReportFilterGroup[] = []
    if (customerOptions.length > 0) {
      groups.push({
        key: 'klant', label: t('contacts.filters.customer'), type: 'search-select',
        selected: selectedCustomers,
        options: customerOptions.map(c => ({
          value: c, label: c,
          count: contacts.filter(x => x.customer_name === c).length,
        })),
        onToggle: v => setSelectedCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    groups.push({
      key: 'berichten', label: t('contacts.filters.planningContact'),
      selected: selectedReceives,
      options: [
        { value: 'ja',  label: t('contacts.planningYes'), count: contacts.filter(c => Boolean(c.scheduled_order_contact)).length },
        { value: 'nee', label: t('contacts.planningNo'),  count: contacts.filter(c => !c.scheduled_order_contact).length },
      ],
      onToggle: v => setSelectedReceives(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    })
    return groups
  }, [t, customerOptions, selectedCustomers, selectedReceives, contacts])

  useEffect(() => {
    registerFilters('contact-persons', filterGroups)
    return () => unregisterFilters('contact-persons')
  }, [filterGroups, registerFilters, unregisterFilters])

  const TH: CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
               color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
               whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const TD: CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--hover-bg)', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {t('contacts.title')}
          </h2>
          {!loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {t('contacts.summary', { shown: filtered.length, total: contacts.length })}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, width: 260 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('contacts.search')}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                     fontSize: 12, color: 'var(--text)' }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', flex: 1 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TH}>{t('contacts.cols.customer')}</th>
                <th style={TH}>{t('contacts.cols.name')}</th>
                <th style={TH}>{t('contacts.cols.email')}</th>
                <th style={TH}>{t('contacts.cols.phone')}</th>
                <th style={TH}>{t('contacts.cols.planningContact')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('contacts.loading')}
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('contacts.empty')}
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
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {/* Customer — first column */}
                    <td style={{ ...TD, minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                          {c.customer_name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Name */}
                    <td style={{ ...TD, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 10, fontWeight: 600 }}>
                          {initials || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{name}</div>
                          {c.function_title && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.function_title}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ ...TD, minWidth: 180 }}>
                      {c.email
                        ? <a href={`mailto:${c.email}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 5,
                                     color: 'var(--color-secondary)', textDecoration: 'none', fontSize: 12 }}>
                            <Mail size={11} />{c.email}
                          </a>
                        : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>

                    {/* Phone */}
                    <td style={{ ...TD, minWidth: 130 }}>
                      {c.mobile
                        ? <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text)' }}>
                            <Phone size={11} color="var(--text-muted)" />{c.mobile}
                          </div>
                        : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>

                    {/* Planning contact */}
                    <td style={TD}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                        background: isPlanning ? 'var(--color-success-bg)' : 'var(--hover-bg)',
                        color:      isPlanning ? 'var(--color-success)'  : 'var(--text-muted)',
                        border:     `1px solid ${isPlanning ? '#BBF7D0' : 'var(--border)'}`,
                      }}>
                        {isPlanning
                          ? <><MessageCircle size={10} /> {t('contacts.yes')}</>
                          : <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)' }} /> {t('contacts.no')}</>}
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
