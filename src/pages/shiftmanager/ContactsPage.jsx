import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, MessageCircle, MapPin } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import api, { unwrapList } from '../../lib/api'
import { isAbortError } from '../../lib/mocks'
import { ac, ContactAvatar } from './contactParts'
import ContactDrawer from './ContactDrawer'

export default function ContactsPage() {
  const { t } = useTranslation('shiftmanager')
  const [contacts,    setContacts]    = useState([])
  const [search]                      = useState('')
  const [selected,    setSelected]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [selCustomers,  setSelCustomers]  = useState([])
  const [selPlanning, setSelPlanning] = useState([])
  const pageSize = 12

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Load contacts from the ShiftManager mirror. A failed/empty call shows an
  // empty list, never fabricated rows.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_contacts', { signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList(res)
        setContacts(rows.map(c => ({
          id:             c.id,
          firstname:      c.first_name ?? c.firstname ?? '',
          lastname:       c.last_name ?? c.lastname ?? '',
          function_title: c.function_title ?? '',
          customer:       c.customer?.name ?? c.customer ?? '',
          location:       c.location?.name ?? c.location ?? '',
          email:          c.email ?? '',
          mobile:         c.mobile ?? '',
          planning:       !!c.planning,
        })))
      })
      .catch(err => { if (!isAbortError(err)) setContacts([]) })
    return () => ctrl.abort()
  }, [])

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const customerOptions = useMemo(() => [...new Set(contacts.map(c => c.customer).filter(Boolean))].sort(), [contacts])

  const filterGroups = useMemo(() => [
    { key: 'klant', label: t('contactsPage.cols.customer'),
      options: customerOptions.map(k => ({ value: k, label: k, count: contacts.filter(c => c.customer === k).length })),
      selected: selCustomers, onToggle: toggle(setSelCustomers) },
    { key: 'planning', label: t('contactsPage.planningContact'),
      options: [
        { value: 'ja',  label: t('contactsPage.planningContact'),   count: contacts.filter(c => c.planning).length },
        { value: 'nee', label: t('contactsPage.noPlanningContact'), count: contacts.filter(c => !c.planning).length },
      ],
      selected: selPlanning, onToggle: toggle(setSelPlanning) },
  ], [t, customerOptions, contacts, selCustomers, selPlanning])

  useEffect(() => {
    registerFilters('klanten-contacts', filterGroups)
    return () => unregisterFilters('klanten-contacts')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    let rows = contacts
    if (selCustomers.length)  rows = rows.filter(c => selCustomers.includes(c.customer))
    if (selPlanning.length) rows = rows.filter(c => selPlanning.includes(c.planning ? 'ja' : 'nee'))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(c => {
        const n = [c.firstname, c.lastname].join(' ').toLowerCase()
        return n.includes(q) || c.customer.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      })
    }
    return rows
  }, [contacts, search, selCustomers, selPlanning])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paged      = filtered.slice((page - 1) * pageSize, page * pageSize)

  const kpis = [
    { label: t('contactsPage.kpi.contacts'),         value: contacts.length },
    { label: t('contactsPage.kpi.planningContacts'), value: contacts.filter(c => c.planning).length },
    { label: t('contactsPage.kpi.customers'),        value: customerOptions.length },
  ]

  const headers = [
    t('contactsPage.cols.name'), t('contactsPage.cols.customer'), t('contactsPage.cols.location'),
    t('contactsPage.cols.email'), t('contactsPage.cols.phone'), t('contactsPage.cols.planning'),
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* KPI strip */}
        <div style={{ padding: '20px 24px 18px', display: 'flex', gap: 16, flexShrink: 0 }}>
          {kpis.map(k => (
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
                  {headers.map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const name  = [c.firstname, c.lastname].filter(Boolean).join(' ')
                  const isSel = selected?.id === c.id
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
                          <ContactAvatar name={name} size={30} />
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
                            fontSize: 8, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
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
                          background: c.planning ? 'var(--color-success-bg)' : 'var(--hover-bg)',
                          color:      c.planning ? 'var(--color-success)'  : 'var(--text-muted)',
                          border:     `1px solid ${c.planning ? '#BBF7D0' : 'var(--border)'}` }}>
                          {c.planning ? <><MessageCircle size={10} /> {t('contactsPage.yes')}</> : t('contactsPage.no')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 13 }}>{t('contactsPage.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{t('contactsPage.count', { count: filtered.length })}</span>
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
