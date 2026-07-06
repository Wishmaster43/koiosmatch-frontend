import { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import ContactsTable from './ContactsTable'
import PaginationBar from '@/components/ui/PaginationBar'
import ContactDrawer from './ContactDrawer'
import { useSmContacts } from './hooks/useSmContacts'
import type { SmContactRow } from '@/types/shiftmanager'

export default function ContactsPage() {
  const { t } = useTranslation('shiftmanager')
  // Data (fetch + transform) lives in the shared hook (§3).
  const { contacts } = useSmContacts()
  const [search]                      = useState('')
  const [selected,    setSelected]    = useState<SmContactRow | null>(null)
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(50)
  const [selCustomers,  setSelCustomers]  = useState<string[]>([])
  const [selPlanning, setSelPlanning] = useState<string[]>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const customerOptions = useMemo(() => [...new Set(contacts.map(c => c.customer).filter((x): x is string => Boolean(x)))].sort(), [contacts])

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
    if (selCustomers.length)  rows = rows.filter(c => selCustomers.includes(c.customer as string))
    if (selPlanning.length) rows = rows.filter(c => selPlanning.includes(c.planning ? 'ja' : 'nee'))
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(c => {
        const n = [c.firstname, c.lastname].join(' ').toLowerCase()
        return n.includes(q) || (c.customer ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
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

        {/* Table — shared DataTable (sticky header, sorting, soft-chip planning flag) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
          <ContactsTable rows={paged} selectedId={selected?.id}
            onSelect={c => setSelected(prev => prev?.id === c.id ? null : c)} />
        </div>

        <PaginationBar page={page} totalPages={totalPages} totalRows={filtered.length} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
      </div>

      <ContactDrawer contact={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
