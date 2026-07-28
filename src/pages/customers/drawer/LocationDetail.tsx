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
import { getCountryOptions } from '@/lib/countries'
import { useProvinces } from '@/hooks/useProvinces'
import { emailValue, phoneValue, kvkValue, vatValue } from '@/components/drawer/contactLinks'
// JOB-STATUS-1 (Danny 28-07: "Status van locatie moet hier!!") — the read-only
// title-row badge (§3A(c)) + the searchable picker reused for its inline edit.
import TitleBadge from '@/components/drawer/TitleBadge'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useConfirm } from '@/hooks/useConfirm'
import DepartmentsPanel from './DepartmentsPanel'
import ContactsPanel from './ContactsPanel'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import PdokCard from '@/components/drawer/PdokCard'
import { buildLocationAdviceInsights } from './locationAiInsights'
import ContactNameLink from './ContactNameLink'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
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
  /** Label of the list this location was opened from — the first breadcrumb. */
  backLabel?: string
  onRemoveContact: (id: Id) => void
  close: () => void
}

export default function LocationDetail({
  location: l, customerId, locations, departments, contacts, statuses, departmentStatuses, contactStatuses, canLinkBackoffice = false,
  onSave, onDelete, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact, onRemoveContact,
  backLabel, close,
}: Props) {
  const { t, i18n } = useTranslation('customers')

  // Country/province option lists. The province list cascades on the country ALREADY
  // SAVED on this location (the shared field table owns its own draft, so an in-edit
  // country switch is not observable here) — for a Dutch tenant that is the normal case,
  // and a wrong-country list would be worse than a stale one.
  const countryOptions = getCountryOptions(i18n.language).map(o => ({ value: o.label, label: o.label }))
  const countryCode = getCountryOptions(i18n.language).find(o => o.label === (l.country ?? ''))?.value ?? 'NL'
  const { provinces } = useProvinces(countryCode)
  const provinceOptions = provinces.map((p: string) => ({ value: p, label: p }))


  // A contact opened from this location's own list. The panel owns the id; this flag only
  // tells the location to stand back (no second title, sub-tab bar or delete button).
  const [openContactId, setOpenContactId] = useState<Id | null>(null)
  const contactOpen = openContactId != null
  // A department opened from this location's own list — same rule as a contact: it takes
  // over the body and brings the full trail, so the location shows no second title.
  const [openDepartmentId, setOpenDepartmentId] = useState<Id | null>(null)
  const departmentOpen = openDepartmentId != null

  const { confirm, dialog } = useConfirm()
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  // The Extra sub-tab only shows when the tenant has defined customer_location custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_location')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Adres & gegevens. Each
  // EditableFieldTable below manages its own uncontrolled edit toggle (they no
  // longer share one global pencil now that they live on separate sub-tabs).
  const [subTab, setSubTab] = useState<'address' | 'departments' | 'contacts' | 'extra' | 'koppelingen'>('address')

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // Algemeen/Adres/Registratie/Contact ter plaatse — the "Adres & gegevens" sub-tab.
  // Street/no/suffix/postcode/city collapse into ONE composed line in read mode
  // (the 'address' composite, mirrors the candidate profile address row) and only
  // expand to loose fields while editing; state/country stay their own rows.
  const generalFields: FieldRow[] = [
    { key: 'name', label: t('locations.detail.name'), type: 'text', group: t('overview.details') },
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
    // Searchable pickers, not free text (Danny 28-07). NOTE the value format: unlike the
    // candidate, a location stores the country NAME ("Nederland"), not an ISO-2 code — so
    // the options carry names as values. Switching to codes here would silently rewrite
    // every stored country on the next save.
    { key: 'state', label: t('locations.detail.state'), type: 'select', options: provinceOptions, group: t('subModal.groups.address') },
    { key: 'country', label: t('locations.detail.country'), type: 'select', options: countryOptions, group: t('subModal.groups.address') },
    { key: 'cocNumber', label: t('locations.detail.coc'), type: 'text', group: t('overview.details'),
      renderValue: v => kvkValue(v, t('locations.detail.openKvk')) },
    { key: 'vatNumber', label: t('locations.detail.vat'), type: 'text', group: t('overview.details'),
      renderValue: v => vatValue(v, t('locations.detail.openVies')) },
    // Kostenplaats sits in Gegevens (Danny 28-07) — it is one field, and a whole
    // Facturatie sub-tab for one field was more chrome than content. There is still no
    // billing-email input here: invoicing ALWAYS comes from the customer regardless of
    // the location picked on a match, so an editable one would be a misleading
    // affordance (§3) — see OverviewTab for the real billing email.
    { key: 'costCenter', label: t('locations.detail.costCenter'), type: 'text', group: t('overview.details') },
    // "Contact ter plaatse" is FREE TEXT on the location (customer_locations.contact_name),
    // not a reference to a contact record — so it can only become a link when the typed
    // name resolves to EXACTLY ONE of this customer's contacts. Two people called "Jan
    // de Vries" (or none) leave it as plain text: a link that opens the wrong person is
    // worse than no link. Making this a real relation is CMBE ticket LOCATIE-PRIMAIR-1.
    { key: 'contactName', label: t('locations.detail.contactName'), type: 'text', group: t('locations.detail.contactTitle'),
      renderValue: v => {
        const typed = typeof v === 'string' ? v.trim() : ''
        if (!typed) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
        const byName = (c: Contact) => c.name.trim().toLowerCase() === typed.toLowerCase()
        // Look at THIS location's own contacts first. Measured on the demo data: the same
        // person exists as a separate record per location ("Eva Bos" four times, one per
        // site), so a customer-wide name match finds several and would refuse to link at
        // all — while "contact ter plaatse" obviously means the one AT this location.
        const here = contacts.filter(c => String(c.locationId) === String(l.id)).filter(byName)
        const hits = here.length > 0 ? here : contacts.filter(byName)
        return <ContactNameLink name={typed} id={hits.length === 1 ? hits[0].id : null}
          onOpen={id => { setSubTab('contacts'); setOpenContactId(id) }} title={t('contacts.openContact')} />
      } },
    { key: 'email', label: t('locations.detail.email'), type: 'text', group: t('locations.detail.contactTitle'),
      renderValue: v => emailValue(v, t('overview.sendEmail')) },
    { key: 'phone', label: t('locations.detail.phone'), type: 'text', group: t('locations.detail.contactTitle'),
      renderValue: v => phoneValue(v, t('overview.callPhone')) },
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

  // A contact opened from this location's own list takes over the whole body: it brings
  // its own breadcrumb (Locaties › deze vestiging › de persoon), so showing the location's
  // title, sub-tab bar and delete button underneath would mean two titles and two delete
  // buttons with different blast radii on one narrow panel.
  if (departmentOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <DepartmentsPanel scope="location" scopeId={l.id as Id} scopeName={l.name}
          departments={departments} locations={locations} contacts={contacts}
          statuses={departmentStatuses} contactStatuses={contactStatuses}
          openId={openDepartmentId} onOpenChange={setOpenDepartmentId}
          trail={[{ label: backLabel ?? '', onClick: close }]}
          onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onRemove={onRemoveDepartment}
          onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact} />
      </div>
    )
  }

  if (contactOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ContactsPanel scope="location" scopeId={l.id as Id} scopeName={l.name} contacts={contacts} locations={locations}
          openId={openContactId} onOpenChange={setOpenContactId} trail={[{ label: backLabel ?? '', onClick: close }]}
          onRemove={onRemoveContact}
          departments={departments} statuses={contactStatuses} onAdd={onAddContact} onUpdate={onUpdateContact} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* One way back per level: the shared trail replaces SubEntityTab's own button. */}
      <DrillBreadcrumb trail={[{ label: backLabel ?? '', onClick: close }]} current={l.name} />
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
          {/* Same block order as the customer's Bedrijf tab (Danny 28-07: "zelfde format
              als klant"): Gegevens · Adres · Contact. Registratie is no longer its own
              card — KvK and BTW are plain facts about this site, so they sit in Gegevens
              next to the name instead of behind their own heading. */}
          {[t('overview.details'), t('subModal.groups.address'), t('locations.detail.contactTitle')].map(group => (
            <EditableFieldTable key={group} title={group} labelWidth={140} value={values} onSave={save}
              fields={generalFields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))} />
          ))}

          {/* Koios advice, in the same slot the customer tab puts it: after the fields.
              Pure FE heuristics over this location's OWN completeness — no API call. */}
          <KoiosAdviceBlock namespace="customers" insights={buildLocationAdviceInsights(l, t)} />
        </div>
      )}

      {/* The SAME panel the customer's Afdelingen tab renders — one department surface. */}
      {subTab === 'departments' && (
        <DepartmentsPanel scope="location" scopeId={l.id as Id} scopeName={l.name}
          departments={departments} locations={locations} contacts={contacts}
          statuses={departmentStatuses} contactStatuses={contactStatuses}
          openId={openDepartmentId} onOpenChange={setOpenDepartmentId}
          trail={[{ label: backLabel ?? '', onClick: close }]}
          onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onRemove={onRemoveDepartment}
          onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact} />
      )}

      {subTab === 'contacts' && (
        <ContactsPanel scope="location" scopeId={l.id as Id} scopeName={l.name} contacts={contacts} locations={locations}
          openId={openContactId} onOpenChange={setOpenContactId} trail={[{ label: backLabel ?? '', onClick: close }]}
          onRemove={onRemoveContact}
          departments={departments} statuses={contactStatuses} onAdd={onAddContact} onUpdate={onUpdateContact} />
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_location" values={l.customFields ?? {}}
          onSave={patch => onSave(l.id as Id, { customFields: { ...l.customFields, ...patch } })} />
      )}

      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="locations" id={l.id as Id} helloflexLink={l.helloflexLink} shiftmanagerLink={l.shiftmanagerLink} canLink={canLinkBackoffice}>
          {/* PDOK sits in Koppelingen, like every other integration (Danny 28-07). No
              `endpoint`: a customer location has lat/lng and the backend fills them, but
              there is no per-location re-geocode route yet — so the card reads, it does
              not pretend to act. HelloFlex/Shiftmanager gate themselves on the tenant's
              connector apps, which is why Yesway sees Shiftmanager and not HelloFlex. */}
          <PdokCard lat={l.lat} lng={l.lng} permission="customers.update" />
        </BackofficeLinksTab>
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
