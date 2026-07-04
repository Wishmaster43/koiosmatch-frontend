/**
 * LocationsTab — the customer's locations as a searchable table; a row drills into
 * a rich detail (C-6 address fields + nested departments + contacts + a planning
 * summary scoped to that location). Adds via the parent's onAdd callback.
 */
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import type { Column } from '@/components/ui/DataTable'
import DetailTableJs from '@/components/ui/DetailTable'
import SectionCard from '@/components/ui/SectionCard'
import type { Location, Department, Contact } from '@/types/customer'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

// A simple "name + meta" row list used for the nested departments/contacts.
function MiniList<T extends { id?: Id }>({ items, getPrimary, getSecondary, emptyText }: {
  items?: T[]; getPrimary: (it: T) => ReactNode; getSecondary: (it: T) => ReactNode; emptyText: ReactNode
}) {
  if (!items?.length) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</div>
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={it.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
          borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ flex: 1, color: 'var(--text)' }}>{getPrimary(it)}</span>
          {getSecondary(it) && <span style={{ color: 'var(--text-muted)' }}>{getSecondary(it)}</span>}
        </div>
      ))}
    </div>
  )
}

export default function LocationsTab({ customerId, locations = [], onAdd }: { customerId?: Id; locations?: Location[]; onAdd?: () => void }) {
  const { t } = useTranslation('customers')
  // Planning section only exists when the tenant has the module — no dead placeholder
  // ("moet weg, module staat toch uit" — Danny 2026-07-04).
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')

  const columns: Column<Location>[] = [
    { key: 'name', header: t('locations.col.name'), sortable: true, sortValue: l => l.name,
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{l.name}</span>
        </div>
      ) },
    { key: 'city', header: t('locations.col.city'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: l => l.city, render: l => l.city || '—' },
    { key: 'departments', header: t('locations.col.departments'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: l => (l.departments ?? []).length, render: l => (l.departments ?? []).length },
    { key: 'contacts', header: t('locations.col.contacts'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: l => (l.contacts ?? []).length, render: l => (l.contacts ?? []).length },
  ]

  const renderDetail = (l: Location) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{l.name}</div>

      <SectionCard title={t('locations.detail.addressTitle')}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <DetailTable rows={[
            [t('locations.detail.street'), [l.street, l.houseNumber].filter(Boolean).join(' ') + (l.houseNumberSuffix || '')],
            [t('locations.detail.postalCode'), [l.postalCode, l.city].filter(Boolean).join(' ')],
            [t('locations.detail.country'), l.country],
            [t('locations.detail.coc'), l.cocNumber],
            [t('locations.detail.vat'), l.vatNumber],
            [t('locations.detail.contactName'), l.contactName],
            [t('locations.detail.phone'), l.phone],
            [t('locations.detail.email'), l.email],
          ]} labelWidth={130} lastBorder={false} />
        </div>
      </SectionCard>

      <SectionCard title={t('locations.detail.departmentsHere')}>
        <MiniList<Department> items={l.departments} getPrimary={d => d.name} getSecondary={() => ''} emptyText={t('locations.detail.none')} />
      </SectionCard>

      <SectionCard title={t('locations.detail.contactsHere')}>
        <MiniList<Contact> items={l.contacts} getPrimary={p => p.name} getSecondary={p => [p.role, p.email].filter(Boolean).join(' · ')} emptyText={t('locations.detail.none')} />
      </SectionCard>

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ location_id: l.id }} />
        </SectionCard>
      )}
    </div>
  )

  return (
    <SubEntityTab
      items={locations}
      columns={columns}
      addLabel={t('locations.add')}
      emptyText={t('locations.empty')}
      searchPlaceholder={t('locations.searchPlaceholder')}
      backLabel={t('drawer.back')}
      searchKeys={['name', 'city']}
      onAdd={onAdd}
      renderDetail={renderDetail}
    />
  )
}
