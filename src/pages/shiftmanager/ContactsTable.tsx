/**
 * ContactsTable — contact-person list, mirrors CustomersTable/DepartmentsTable:
 * only declares columns and hands them to the shared DataTable (sticky header,
 * sorting, selection, empty state). The planning flag renders as a soft-chip.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { Mail, Phone, MessageCircle, MapPin } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import { ac, ContactAvatar } from './contactParts'
import type { SmContactRow } from '@/types/shiftmanager'

const mutedCell: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 }
const fullName = (c: SmContactRow) => [c.firstname, c.lastname].filter(Boolean).join(' ')

export default function ContactsTable({ rows, loading, selectedId, onSelect }: {
  rows: SmContactRow[]
  loading?: boolean
  selectedId?: string | number | null
  onSelect?: (row: SmContactRow) => void
}) {
  const { t } = useTranslation('shiftmanager')

  const columns: Column<SmContactRow>[] = [
    {
      key: 'name', header: t('contactsPage.cols.name'), sortable: true, sortValue: c => fullName(c),
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <ContactAvatar name={fullName(c)} size={30} />
          <div>
            <div style={{ fontWeight: 500, color: 'var(--text)' }}>{fullName(c)}</div>
            {c.function_title && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.function_title}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'customer', header: t('contactsPage.cols.customer'), sortable: true, sortValue: c => c.customer ?? '', nowrap: true,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: ac(c.customer), display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
            {c.customer?.charAt(0)}
          </div>
          <span style={{ color: 'var(--text)' }}>{c.customer || '—'}</span>
        </div>
      ),
    },
    {
      key: 'location', header: t('contactsPage.cols.location'), sortable: true, sortValue: c => c.location ?? '', nowrap: true,
      render: c => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{c.location || '—'}</span>
        </div>
      ),
    },
    {
      key: 'email', header: t('contactsPage.cols.email'), sortable: true, sortValue: c => c.email ?? '', nowrap: true,
      render: c => c.email
        ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Mail size={11} />{c.email}
          </a>
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'phone', header: t('contactsPage.cols.phone'), cellStyle: mutedCell, nowrap: true, sortable: true, sortValue: c => c.mobile ?? '',
      render: c => c.mobile
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text)' }}><Phone size={11} color="var(--text-muted)" />{c.mobile}</span>
        : '—',
    },
    {
      key: 'planning', header: t('contactsPage.cols.planning'), sortable: true, sortValue: c => (c.planning ? 1 : 0),
      render: c => (
        <SoftChip round color={c.planning ? 'var(--color-success)' : 'var(--text-muted)'}
          label={c.planning ? <><MessageCircle size={10} /> {t('contactsPage.yes')}</> : t('contactsPage.no')} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      onRowClick={onSelect}
      selectedId={selectedId}
      loading={loading}
      emptyText={t('contactsPage.empty')}
      stickyHeader
    />
  )
}
