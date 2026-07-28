/**
 * LocationDetail — the Locaties-tab drill-down (Danny 13/7: "kan niets wijzigen,
 * de naam niets???"). Fully editable via the shared EditableFieldTable house
 * pattern (pencil → save/cancel, optimistic PATCH via the parent's onSave).
 * Danny 2026-07-14: reorganised into SUB-TABS (short labels, mirrors the
 * candidate drawer's Communicatie sub-tab bar via the shared SubTabBar) —
 * Adres & gegevens (Algemeen/Adres/Registratie/Contact ter plaatse) · Facturatie ·
 * Afdelingen · Contactpersonen — default Adres & gegevens. The street/no/suffix/
 * postcode/city fields collapse into ONE composed address line in read mode
 * (EditableFieldTable's 'address' composite, mirrors the candidate profile
 * address row) and only expand to loose fields while editing.
 * Nested department + contact management for this location lives in
 * LocationDepartments / LocationContacts (shared hooks, one source of truth with
 * the top-level tabs). Delete asks for confirmation and returns to the list.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Edit2, Save, X } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SectionCard from '@/components/ui/SectionCard'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import { emailValue, phoneValue, kvkValue, vatValue } from '@/components/drawer/contactLinks'
// JOB-STATUS-1 (Danny 28-07: "Status van locatie moet hier!!") — the read-only
// title-row badge (§3A(c)) + the searchable picker reused for its inline edit.
import TitleBadge from '@/components/drawer/TitleBadge'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useConfirm } from '@/hooks/useConfirm'
import LocationDepartments from './LocationDepartments'
import LocationContacts from './LocationContacts'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import { useCustomFields } from '@/lib/useCustomFields'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { LocationPayload } from '../hooks/useCustomerLocations'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

interface Props {
  location: Location
  customerId?: Id
  locations: { id: Id; name: string }[]
  departments: Department[]
  contacts: Contact[]
  statuses: LookupOption[]
  departmentStatuses: LookupOption[]
  contactStatuses: LookupOption[]
  // EXTRACT-1: the caller's own customers.update permission check for the
  // Koppelingen sub-tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  onSave: (id: Id, payload: Partial<LocationPayload>) => void
  onDelete: (id: Id) => void
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  close: () => void
}

export default function LocationDetail({
  location: l, customerId, locations, departments, contacts, statuses, departmentStatuses, contactStatuses, canLinkBackoffice = false,
  onSave, onDelete, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact, close,
}: Props) {
  const { t } = useTranslation('customers')
  const { confirm, dialog } = useConfirm()
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  // The Extra sub-tab only shows when the tenant has defined customer_location custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_location')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Adres & gegevens. Each
  // EditableFieldTable below manages its own uncontrolled edit toggle (they no
  // longer share one global pencil now that they live on separate sub-tabs).
  const [subTab, setSubTab] = useState<'address' | 'billing' | 'departments' | 'contacts' | 'extra' | 'koppelingen'>('address')

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // Algemeen/Adres/Registratie/Contact ter plaatse — the "Adres & gegevens" sub-tab.
  // Street/no/suffix/postcode/city collapse into ONE composed line in read mode
  // (the 'address' composite, mirrors the candidate profile address row) and only
  // expand to loose fields while editing; state/country stay their own rows.
  const generalFields: FieldRow[] = [
    { key: 'name', label: t('locations.detail.name'), type: 'text', group: t('subModal.groups.general') },
    // JOB-STATUS-1: status moved OUT of this field table into the title-row badge
    // (see the render below) — no longer a row here, Danny 28-07: "moet HIER".
    { key: 'address', label: t('subModal.groups.address'), type: 'address', group: t('subModal.groups.address'),
      addressFields: [
        { key: 'street', label: t('locations.detail.street'), type: 'text' },
        { key: 'houseNumber', label: t('locations.detail.houseNumber'), type: 'text' },
        { key: 'houseNumberSuffix', label: t('locations.detail.houseNumberSuffix'), type: 'text' },
        { key: 'postalCode', label: t('locations.detail.postalCode'), type: 'text' },
        { key: 'city', label: t('locations.detail.city'), type: 'text' },
      ] },
    { key: 'state', label: t('locations.detail.state'), type: 'text', group: t('subModal.groups.address') },
    { key: 'country', label: t('locations.detail.country'), type: 'text', group: t('subModal.groups.address') },
    { key: 'cocNumber', label: t('locations.detail.coc'), type: 'text', group: t('locations.detail.registrationTitle'),
      renderValue: v => kvkValue(v, t('locations.detail.openKvk')) },
    { key: 'vatNumber', label: t('locations.detail.vat'), type: 'text', group: t('locations.detail.registrationTitle'),
      renderValue: v => vatValue(v, t('locations.detail.openVies')) },
    { key: 'contactName', label: t('locations.detail.contactName'), type: 'text', group: t('locations.detail.contactTitle') },
    { key: 'email', label: t('locations.detail.email'), type: 'text', group: t('locations.detail.contactTitle'),
      renderValue: v => emailValue(v, t('overview.sendEmail')) },
    { key: 'phone', label: t('locations.detail.phone'), type: 'text', group: t('locations.detail.contactTitle'),
      renderValue: v => phoneValue(v, t('overview.callPhone')) },
  ]
  // Facturatie — its own sub-tab, own EditableFieldTable instance/pencil. No
  // billingEmail input here (Danny 2026-07-22): facturatie ALWAYS comes from the
  // customer regardless of the picked location, so an editable field here would
  // be a misleading affordance (§3) — see OverviewTab for the real billing email.
  const billingFields: FieldRow[] = [
    { key: 'costCenter', label: t('locations.detail.costCenter'), type: 'text' },
  ]

  const values = {
    name: l.name,
    street: l.street, houseNumber: l.houseNumber, houseNumberSuffix: l.houseNumberSuffix,
    postalCode: l.postalCode, city: l.city, state: l.state, country: l.country,
    cocNumber: l.cocNumber, vatNumber: l.vatNumber,
    contactName: l.contactName, email: l.email, phone: l.phone,
    costCenter: l.costCenter,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(l.id as Id, {
      name: v.name as string,
      street: v.street as string, houseNumber: v.houseNumber as string, houseNumberSuffix: v.houseNumberSuffix as string,
      postalCode: v.postalCode as string, city: v.city as string, state: v.state as string, country: v.country as string,
      cocNumber: v.cocNumber as string, vatNumber: v.vatNumber as string,
      contactName: v.contactName as string, email: v.email as string, phone: v.phone as string,
      costCenter: v.costCenter as string,
    })
  }

  const remove = () => confirm(t('locations.detail.confirmDelete'), () => { onDelete(l.id as Id); close() }, { danger: true })

  // JOB-STATUS-1: the title-row status badge's own inline edit — pencil toggles to
  // a searchable CreatableSelect + save/cancel (same in-place-edit convention as
  // EditableFieldTable/EditableRichTextField, §3A), independent of the general
  // fields' own save cycle since status now lives entirely in the title row.
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const startEditStatus = () => { setStatusDraft(l.statusId != null ? String(l.statusId) : ''); setEditingStatus(true) }
  const saveStatus = () => { onSave(l.id as Id, { statusId: statusDraft || null }); setEditingStatus(false) }
  const cancelStatus = () => setEditingStatus(false)
  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{l.name}</div>
          <ReferenceNumberChip value={l.referenceNumber} />
          {editingStatus ? (
            // Inline picker in the title row (Danny 28-07: "Status van locatie moet hier!!")
            // — searchable, pick-only (allowCreate off, same as every tenant-lookup select).
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 170 }}>
                <CreatableSelect value={statusDraft} onChange={setStatusDraft} options={statusOptions}
                  placeholder={t('locations.detail.status')} allowCreate={false} menuWidth={180} />
              </div>
              <button onClick={saveStatus} title={t('common:save')} aria-label={t('common:save')}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancelStatus} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <>
              {/* Status = colour-coded read-only badge next to the title (§3A(c)), not
                  buried as a row in Algemeen — the pencil reopens the picker above. */}
              <TitleBadge label={l.statusLabel} color={l.statusColor} />
              <button onClick={startEditStatus} title={t('locations.detail.changeStatus')} aria-label={t('locations.detail.changeStatus')}
                style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
            </>
          )}
        </div>
        <button onClick={remove} title={t('locations.detail.deleteLocation')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)', flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Sub-tab strip — same shared bar as the candidate Communicatie tab; short labels. */}
      <SubTabBar
        tabs={[
          { id: 'address',     label: t('locations.detail.addressTitle') },
          { id: 'billing',     label: t('locations.detail.billingTitle') },
          { id: 'departments', label: t('drawer.tabs.departments') },
          { id: 'contacts',    label: t('drawer.tabs.contacts') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          // EXTRACT-1: the shared Koppelingen sub-tab, always last (§3A/§11) — the
          // shared common:backofficeLinks.tabLabel key, not this file's own labels.
          { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel') },
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {/* Adres & gegevens — no repeated title (it would duplicate the sub-tab label). */}
      {subTab === 'address' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[t('subModal.groups.general'), t('subModal.groups.address'),
            t('locations.detail.registrationTitle'), t('locations.detail.contactTitle')].map(group => (
            <EditableFieldTable key={group} title={group} labelWidth={140} value={values} onSave={save}
              fields={generalFields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))} />
          ))}
        </div>
      )}

      {subTab === 'billing' && (
        <EditableFieldTable title="" fields={billingFields} value={values} onSave={save} labelWidth={140} />
      )}

      {subTab === 'departments' && (
        <LocationDepartments locationId={l.id as Id} locationName={l.name} departments={departments} locations={locations}
          statuses={departmentStatuses} onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onRemove={onRemoveDepartment} />
      )}

      {subTab === 'contacts' && (
        <LocationContacts locationId={l.id as Id} locationName={l.name} contacts={contacts} locations={locations}
          departments={departments} statuses={contactStatuses} onAdd={onAddContact} onUpdate={onUpdateContact} />
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_location" values={l.customFields ?? {}}
          onSave={patch => onSave(l.id as Id, { customFields: { ...l.customFields, ...patch } })} />
      )}

      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="locations" id={l.id as Id} helloflexLink={l.helloflexLink} shiftmanagerLink={l.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ location_id: l.id }} />
        </SectionCard>
      )}
      {dialog}
    </div>
  )
}
