/**
 * DepartmentsTab — the customer's departments (nested under locations) as a
 * searchable table; a row drills into detail (info + contacts in the department +
 * a planning summary scoped to that department). Adds via the parent's onAdd.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Building } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import type { Column } from '@/components/ui/DataTable'
import DetailTableJs from '@/components/ui/DetailTable'
import SectionCard from '@/components/ui/SectionCard'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

export default function DepartmentsTab({ customerId, departments = [], onAdd }: { customerId?: Id; departments?: Department[]; onAdd?: () => void }) {
  const { t } = useTranslation('customers')
  // Planning section only exists when the tenant has the module — no dead placeholder.
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')

  const columns: Column<Department>[] = [
    {
      // NUMMER-1: human-readable reference number (A-001) — narrow, mono, muted.
      key: 'referenceNumber', header: t('departments.col.referenceNumber'), nowrap: true, width: 80,
      cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)' },
      sortable: true, sortValue: d => d.referenceNumber ?? '',
      render: d => d.referenceNumber || '—',
    },
    { key: 'name', header: t('departments.col.name'), sortable: true, sortValue: d => d.name,
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building size={14} color="#8B5CF6" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{d.name}</span>
        </div>
      ) },
    { key: 'location', header: t('departments.col.location'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: d => d.locationName, render: d => d.locationName || '—' },
    { key: 'contacts', header: t('departments.col.contacts'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: d => (d.contacts ?? []).length, render: d => (d.contacts ?? []).length },
  ]

  const renderDetail = (d: Department) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{d.name}</div>

      <SectionCard title={t('departments.detail.infoTitle')}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <DetailTable rows={[
            [t('departments.detail.location'), d.locationName],
            [t('departments.detail.description'), d.description],
          ]} labelWidth={130} lastBorder={false} />
        </div>
      </SectionCard>

      <SectionCard title={t('departments.detail.contactsHere')}>
        {(d.contacts ?? []).length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('departments.detail.none')}</div>
          : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {(d.contacts ?? []).map((p, i, arr) => (
                <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{[p.role, p.email].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
      </SectionCard>

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ department_id: d.id }} />
        </SectionCard>
      )}
    </div>
  )

  return (
    <SubEntityTab
      items={departments}
      columns={columns}
      addLabel={t('departments.add')}
      emptyText={t('departments.empty')}
      searchPlaceholder={t('departments.searchPlaceholder')}
      backLabel={t('drawer.back')}
      searchKeys={['name', 'locationName']}
      onAdd={onAdd}
      renderDetail={renderDetail}
    />
  )
}
