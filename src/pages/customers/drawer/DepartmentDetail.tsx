/**
 * DepartmentDetail — the Afdelingen-tab drill-down. Danny 2026-07-14: reorganised
 * into SUB-TABS (short labels, mirrors LocationDetail/the candidate Communicatie
 * sub-tab bar) — Gegevens (name/location/status + the Omschrijving rich-text
 * block) · Contactpersonen — default Gegevens. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, location (movable
 * per CustomerDepartmentController — `location_id` is `sometimes` on update),
 * status, cost centre (Danny 2026-07-22 — the middle cascade level; billing email
 * stays customer-only, see OverviewTab). Omschrijving is its own rich-text block
 * (EditableRichTextField — own
 * pencil/save/cancel, RichTextEditor + SafeHtml), same pattern as the customer's
 * Teksten section — a bare textarea is no longer the house pattern for prose.
 * Delete asks for confirmation and fails soft (409 = in use) via the hook's own
 * toast. Nested contacts-in-this-department stay read-only here (full contact
 * management lives on the Contactpersonen tab / location detail).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SectionCard from '@/components/ui/SectionCard'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import EditableRichTextField from './EditableRichTextField'
import { useCustomFields } from '@/lib/useCustomFields'
import { useConfirm } from '@/hooks/useConfirm'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'

export default function DepartmentDetail({ department, locations, statuses, contacts = [], onSave, onDelete, close }: {
  department: Department
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  // The customer's contacts filtered to this department by the caller (the resource
  // itself doesn't embed contacts — CustomerDepartmentResource has no `contacts` field).
  contacts?: Contact[]
  onSave: (id: Id, payload: Partial<DepartmentPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  const { confirm, dialog } = useConfirm()
  // The Extra sub-tab only shows when the tenant has defined customer_department custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_department')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Gegevens.
  const [subTab, setSubTab] = useState<'data' | 'contacts' | 'extra'>('data')

  // Description lives in its own rich-text block below (EditableRichTextField),
  // not in this field-table anymore. Kostenplaats (Danny 2026-07-22) is the
  // middle cascade level (afdeling > locatie > klant) — no billing email here,
  // facturatie always comes from the customer (see OverviewTab).
  const fields: FieldRow[] = [
    { key: 'name', label: t('departments.detail.name'), type: 'text' },
    { key: 'locationId', label: t('departments.detail.location'), type: 'select', options: locations.map(l => ({ value: String(l.id), label: l.name })) },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })) },
    { key: 'costCenter', label: t('departments.detail.costCenter'), type: 'text' },
  ]

  // The read/edit values keyed like the fields above; locationId/statusId compare as strings.
  const values = {
    name: department.name,
    locationId: department.locationId != null ? String(department.locationId) : '',
    statusId: department.statusId != null ? String(department.statusId) : '',
    costCenter: department.costCenter,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(department.id as Id, {
      name: v.name as string, locationId: v.locationId as string, statusId: (v.statusId as string) || null,
      costCenter: v.costCenter as string,
    })
  }
  const saveDescription = (html: string) => onSave(department.id as Id, { description: html })

  const remove = () => confirm(t('departments.deleteConfirm'), () => { onDelete(department.id as Id); close() }, { danger: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{department.name}</div>
        <button onClick={remove} title={t('common:delete')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Sub-tab strip — same shared bar as LocationDetail / the candidate Communicatie tab. */}
      <SubTabBar
        tabs={[
          { id: 'data',     label: t('departments.detail.subtabs.data') },
          { id: 'contacts', label: t('drawer.tabs.contacts') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* No repeated title — it would duplicate the sub-tab label. */}
          <EditableFieldTable title="" fields={fields} value={values} onSave={save} labelWidth={130} />
          <EditableRichTextField label={t('departments.detail.description')} value={department.description ?? ''} onSave={saveDescription} />
        </div>
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_department" values={department.customFields ?? {}}
          onSave={patch => onSave(department.id as Id, { customFields: { ...department.customFields, ...patch } })} />
      )}

      {subTab === 'contacts' && (
        <SectionCard title={t('departments.detail.contactsHere')}>
          {contacts.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('departments.detail.none')}</div>
            : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {contacts.map((p, i, arr) => (
                  <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ flex: 1, color: 'var(--text)' }}>{p.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{[p.role, p.email].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      )}
      {dialog}
    </div>
  )
}
