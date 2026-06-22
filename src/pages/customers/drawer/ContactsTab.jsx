/**
 * ContactsTab — the customer's contact persons as a searchable table; a row drills
 * into the full contact detail. This replaces the old cramped contact rows with a
 * proper table + detail. Adds via the parent's onAdd callback.
 */
import { useTranslation } from 'react-i18next'
import { Users, Check } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import DetailTable from '../../../components/ui/DetailTable'
import SectionCard from '../../../components/ui/SectionCard'

export default function ContactsTab({ contacts = [], onAdd }) {
  const { t } = useTranslation('customers')

  const muted = { color: 'var(--text-muted)', fontSize: 12 }
  const columns = [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {p.isPrimary && <Check size={12} color="var(--color-success)" />}
        </div>
      ) },
    { key: 'role',  header: t('contacts.col.role'),  cellStyle: muted, sortable: true, sortValue: p => p.role,  render: p => p.role || '—' },
    { key: 'email', header: t('contacts.col.email'), cellStyle: muted, sortable: true, sortValue: p => p.email, render: p => p.email || '—' },
    { key: 'phone', header: t('contacts.col.phone'), nowrap: true, cellStyle: muted, sortable: true, sortValue: p => p.phone, render: p => p.phone || '—' },
  ]

  const renderDetail = (p) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
      <SectionCard title={t('contacts.detail.infoTitle')}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <DetailTable rows={[
            [t('contacts.detail.role'), p.role],
            [t('contacts.detail.email'), p.email],
            [t('contacts.detail.phone'), p.phone],
            [t('contacts.detail.location'), p.locationName],
            [t('contacts.detail.department'), p.departmentName],
            [t('contacts.detail.primary'), p.isPrimary ? '✓' : '—'],
          ]} labelWidth={130} lastBorder={false} />
        </div>
      </SectionCard>
    </div>
  )

  return (
    <SubEntityTab
      items={contacts}
      columns={columns}
      addLabel={t('contacts.add')}
      emptyText={t('contacts.empty')}
      searchPlaceholder={t('contacts.searchPlaceholder')}
      backLabel={t('drawer.back')}
      searchKeys={['name', 'role', 'email']}
      onAdd={onAdd}
      renderDetail={renderDetail}
    />
  )
}
