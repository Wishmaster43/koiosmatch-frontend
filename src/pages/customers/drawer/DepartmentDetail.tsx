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
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import ContactsPanel from './ContactsPanel'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import EditableRichTextField from './EditableRichTextField'
import { useCustomFields } from '@/lib/useCustomFields'
import { useConfirm } from '@/hooks/useConfirm'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

export default function DepartmentDetail({ department, locations, statuses, contactStatuses = [], departments = [], contacts = [], canLinkBackoffice = false, trail = [], onAddContact, onUpdateContact, onRemoveContact, onSave, onDelete, close }: {
  department: Department
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  // The customer's contacts filtered to this department by the caller (the resource
  // itself doesn't embed contacts — CustomerDepartmentResource has no `contacts` field).
  contacts?: Contact[]
  // EXTRACT-1: the caller's own customers.update permission check for the
  // Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  /** Lookups + writers the shared ContactsPanel needs (same set the location gets). */
  contactStatuses?: LookupOption[]
  departments?: Department[]
  /**
   * The clickable ancestors above this department. A department opened from the customer
   * tab gets one crumb ("Afdelingen"); one opened inside a location gets two
   * ("Locaties › Vestiging Noord"), so every hop stays one click — the same trail a
   * contact gets. A single folded label would make the ancestors read as text.
   */
  trail?: Crumb[]
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
  onSave: (id: Id, payload: Partial<DepartmentPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  // A contact opened from this department's own list takes over the body (see LocationDetail).
  const [openContactId, setOpenContactId] = useState<Id | null>(null)
  const contactOpen = openContactId != null

  const { confirm, dialog } = useConfirm()
  // The Extra sub-tab only shows when the tenant has defined customer_department custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_department')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Gegevens.
  const [subTab, setSubTab] = useState<'data' | 'contacts' | 'extra' | 'koppelingen'>('data')

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

  // A contact opened from this department's list brings its own full trail, so the
  // department steps aside — one title, one delete button, one way back.
  if (contactOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* `trail` carries only the ANCESTORS: ContactsPanel appends this department itself
            as its own list crumb (its scopeName IS department.name), so passing it here too
            printed "Dagbesteding › Dagbesteding" — measured live 28-07. */}
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* One way back per level (see LocationDetail for why this replaced the old button). */}
      <DrillBreadcrumb trail={trail} current={department.name} />
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
          // EXTRACT-1: the shared Koppelingen sub-tab, always last (§3A/§11).
          { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') },
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

      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="departments" id={department.id as Id} helloflexLink={department.helloflexLink} shiftmanagerLink={department.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}

      {/* The SAME panel the customer tab and a location render — one contact surface.
          `trail` carries only the ANCESTORS: the panel appends this department itself as its
          own list crumb (its scopeName IS department.name). */}
      {subTab === 'contacts' && (
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      )}
      {dialog}
    </div>
  )
}
