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
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SectionCard from '@/components/ui/SectionCard'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { getCountryOptions } from '@/lib/countries'
import { useProvinces } from '@/hooks/useProvinces'
import { kvkValue, vatValue } from '@/components/drawer/contactLinks'
// JOB-STATUS-1 (Danny 28-07: "Status van locatie moet hier!!") — the read-only
// title-row badge (§3A(c)) + its own inline picker, extracted into a shared
// component (§0.3 split, 2026-08-03 — see that file's own docblock).
import SubEntityStatusTitleRow from './SubEntityStatusTitleRow'
import DrillPager, { type DrillPagerProps } from '@/components/drawer/DrillPager'
import { useConfirm } from '@/hooks/useConfirm'
import EditableRichTextField from './EditableRichTextField'
import DepartmentsPanel from './DepartmentsPanel'
import ContactsPanel from './ContactsPanel'
import LocationContactSection from './LocationContactSection'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import PdokCard from '@/components/drawer/PdokCard'
import LocationBranchSection from './LocationBranchSection'
import { useLocations } from '@/lib/useLocations'
import { buildLocationAdviceInsights } from './locationAiInsights'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import { useCustomFields } from '@/lib/useCustomFields'
// SCOPED-LIST-TAB-1: the location's own Vacatures/Matches sub-tabs (§3A —
// shared config-driven tab, never a forked copy — mirrors DepartmentDetail).
import ScopedVacanciesTab from './ScopedVacanciesTab'
import ScopedMatchesTab from './ScopedMatchesTab'
// SOLLICITATIES-SCOPE-1 (Danny asked 3x at customer level, then again here): the
// location's own Sollicitaties sub-tab — reuses the shared CustomerApplicationsList
// (its `vacancyIds` mode) fed by this location's OWN vacancy ids.
// SUBENTITEIT-DELETE-1: the honest disabled-trash + 409-race counts dialog.
import InUseCountsDialog from './InUseCountsDialog'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { LocationPayload } from '../hooks/useCustomerLocations'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import ScopedSollicitatiesTab from './ScopedSollicitatiesTab'
import { isPrimaryForLocation } from '../hooks/useCustomerContacts'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { DeleteResult } from '../hooks/subEntityDelete'

interface Props {
  location: Location
  customerId?: Id
  // Point 1 (Danny's ten-point round): threaded down to ScopedVacanciesTab's
  // AddVacancyModal lock (mirrors the customer-level VacanciesTab's own lock).
  customerName?: string
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
  // SUBENTITEIT-DELETE-1: widened from `=> void` — see DepartmentDetail's identical
  // comment for why the existing `(id) => void`-typed callers stay compatible.
  onDelete: (id: Id) => void | Promise<DeleteResult>
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
  // ONE-CLICK-COUPLE-2: widened from `=> void` — same widening LocationsTab's own prop
  // already carries (§0.2 honest types, no cast) — the real `useCustomerContacts().add`
  // resolves with the saved contact, and LocationContactSection needs that id to couple
  // a brand-new typed name as this location's primary contact (mirrors AddLocationModal).
  onAddContact: (payload: ContactPayload) => Promise<Contact | void> | void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  /** Label of the list this location was opened from — the first breadcrumb. */
  backLabel?: string
  onRemoveContact: (id: Id) => void
  /** Prev/next through the caller's OWN filtered rows (DRILL-PAGER-1) — absent when
   * the open location fell out of that filtered set (nothing sane to page to). */
  pager?: DrillPagerProps
  close: () => void
}

export default function LocationDetail({
  location: l, customerId, customerName, locations, departments, contacts, statuses, departmentStatuses, contactStatuses, canLinkBackoffice = false,
  onSave, onDelete, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact, onRemoveContact,
  backLabel, pager, close,
}: Props) {
  // SOLLICITATIES-SCOPE-1: 'applications' is also declared here so the new sub-tab's
  // `t('applications:title')` resolves without relying on cross-namespace fallback.
  const { t, i18n } = useTranslation(['customers', 'applications'])

  // Country/province option lists. The province list cascades on the country ALREADY
  // SAVED on this location (the shared field table owns its own draft, so an in-edit
  // country switch is not observable here) — for a Dutch tenant that is the normal case,
  // and a wrong-country list would be worse than a stale one.
  // Province/country pickers. The OPTION VALUE is the ISO-2 CODE, which is what the
  // column actually stores: the backend normalises any country input through
  // CountryCode::normalise (LAND-ISO-1) and the seeder writes 'NL'. This used to remap
  // the options to value=NAME, on the belief that the column held a name — so read mode
  // showed the raw "NL" (no option matched) while edit mode listed "Nederland", and the
  // candidate screens showed the name correctly all along (Danny 02-08). The province
  // list cascades off the same code, which is what useProvinces expects.
  const countryOptions = getCountryOptions(i18n.language)
  const countryCode = getCountryOptions(i18n.language).find(o => o.label === (l.country ?? ''))?.value ?? 'NL'
  const { provinces } = useProvinces(countryCode)
  // The tenant's own establishments — the same GET /locations list the customer's
  // Vestiging block and the match form offer, so all three show one source.
  const branchOptions = useLocations().map(b => ({ value: String(b.value), label: b.label }))
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
  // SUBENTITEIT-DELETE-1: a 409 RACE (something got linked after `inUse` was last
  // read) surfaces the server's own per-relation counts here instead of a blanket toast.
  const [blockedCounts, setBlockedCounts] = useState<Record<string, number> | null>(null)
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  // The Extra sub-tab only shows when the tenant has defined customer_location custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_location')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Adres & gegevens. Each
  // EditableFieldTable below manages its own uncontrolled edit toggle (they no
  // longer share one global pencil now that they live on separate sub-tabs).
  // SCOPED-LIST-TAB-1 added vacancies/matches (no location Taken tab — see WORKLIST).
  // SOLLICITATIES-SCOPE-1 added 'applications'.
  const [subTab, setSubTab] = useState<'address' | 'departments' | 'contacts' | 'vacancies' | 'applications' | 'matches' | 'extra' | 'koppelingen'>('address')

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // CONTACT-LOCATION-PRIMARY-1: THIS site's own primary contact — a real record resolved
  // from the contact↔location coupling flag, not a name matched against free text. It is
  // a DIFFERENT axis from the customer's one main contact (`isPrimary`), which is why the
  // block below names the site it belongs to.
  const primaryContact = contacts.find(c => isPrimaryForLocation(c, l.id as Id)) ?? null
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
    // "Contact ter plaatse" / "Primaire contactpersoon" no longer live here as editable free
    // text — CONTACT-LOCATION-PRIMARY-1 round two (Danny 02-08) merged them into ONE
    // read-only section (LocationContactSection, rendered below) so the two can never again
    // tell a contradicting story about the same person. See that component's own comment.
  ]

  // contactName/email/phone are deliberately NOT here any more (CONTACT-LOCATION-PRIMARY-1
  // round two) — they are no longer editable through a field table, only shown read-only
  // (as a legacy fallback) by LocationContactSection below, straight off `l`.
  const values = {
    name: l.name,
    street: l.street, houseNumber: l.houseNumber, houseNumberSuffix: l.houseNumberSuffix,
    postalCode: l.postalCode, city: l.city, state: l.state, country: l.country,
    cocNumber: l.cocNumber, vatNumber: l.vatNumber,
    costCenter: l.costCenter,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(l.id as Id, {
      name: v.name as string,
      street: v.street as string, houseNumber: v.houseNumber as string, houseNumberSuffix: v.houseNumberSuffix as string,
      postalCode: v.postalCode as string, city: v.city as string, state: v.state as string, country: v.country as string,
      cocNumber: v.cocNumber as string, vatNumber: v.vatNumber as string,
      costCenter: v.costCenter as string,
    })
  }

  // SUBENTITEIT-DELETE-1: awaits the hook's DeleteResult — only close on a real
  // success; a 409 race opens the counts dialog instead of closing over nothing.
  const remove = () => confirm(t('locations.detail.confirmDelete'), () => {
    Promise.resolve(onDelete(l.id as Id)).then(result => {
      if (!result) { close(); return } // legacy void return (older callers/tests)
      if (result.ok) { close(); return }
      if (result.blocked) setBlockedCounts(result.blocked.counts)
    })
  }, { danger: true })
  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): its own rich-text block, same pattern the
  // department detail already uses (EditableRichTextField — own pencil/save/cancel,
  // RichTextEditor + SafeHtml) — a bare textarea is not the house pattern for prose.
  const saveDescription = (html: string) => onSave(l.id as Id, { description: html })

  // A contact opened from this location's own list takes over the whole body: it brings
  // its own breadcrumb (Locaties › deze vestiging › de persoon), so showing the location's
  // title, sub-tab bar and delete button underneath would mean two titles and two delete
  // buttons with different blast radii on one narrow panel.
  if (departmentOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <DepartmentsPanel scope="location" scopeId={l.id as Id} scopeName={l.name}
          customerId={customerId} customerName={customerName}
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
        {/* JOB-STATUS-1: name + reference chip + status badge/picker, extracted
            into a shared component (§0.3 split, 2026-08-03 — also adopted by
            DepartmentDetail, which carried a near-verbatim copy of this block). */}
        <SubEntityStatusTitleRow id={l.id as Id} name={l.name} referenceNumber={l.referenceNumber}
          statusId={l.statusId} statusLabel={l.statusLabel} statusColor={l.statusColor}
          statusOptions={statusOptions} onSave={onSave} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Prev/next through the list this location was opened from (DRILL-PAGER-1) —
              before the delete action, same corner as every other detail pager. */}
          {pager && <DrillPager {...pager} />}
          {/* SUBENTITEIT-DELETE-1: still visible but honestly disabled while a live
              coupling exists (§3 — no fake affordance) — the title explains why,
              same message the old blanket 409 toast used. */}
          <button onClick={remove} disabled={l.inUse}
            title={l.inUse ? t('locations.deleteInUse') : t('locations.detail.deleteLocation')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7,
              cursor: l.inUse ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg)',
              color: l.inUse ? 'var(--text-muted)' : 'var(--color-danger)', opacity: l.inUse ? 0.6 : 1, flexShrink: 0 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Sub-tab strip — same shared bar as the candidate Communicatie tab; short labels. */}
      <SubTabBar
        tabs={[
          { id: 'address',     label: t('locations.detail.addressTitle') },
          { id: 'departments', label: t('drawer.tabs.departments') },
          { id: 'contacts',    label: t('drawer.tabs.contacts') },
          // SCOPED-LIST-TAB-1: read-only lists scoped to this location (§3A shared tab).
          { id: 'vacancies',   label: t('drawer.tabs.vacancies') },
          // SOLLICITATIES-SCOPE-1: reuses the applications page's own title key —
          // already carries full five-locale parity, verified in c0e0d900.
          { id: 'applications', label: t('applications:title') },
          { id: 'matches',     label: t('drawer.tabs.matches') },
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
          {[t('overview.details'), t('subModal.groups.address')].map(group => (
            <EditableFieldTable key={group} title={group} labelWidth={140} value={values} onSave={save}
              fields={generalFields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))} />
          ))}

          {/* CONTACT-LOCATION-PRIMARY-1, round two (Danny 02-08) — ONE contact block, and the
              coupling is the only truth it shows as a link. Setting/changing it lives where
              the people are, on the Contactpersonen sub-tab (the "make primary" star), so
              there is one place that owns the change. See LocationContactSection's own
              comment for why the legacy free text is shown but no longer editable here. */}
          <LocationContactSection
            primaryContact={primaryContact}
            legacyName={l.contactName ?? ''} legacyEmail={l.email ?? ''} legacyPhone={l.phone ?? ''}
            onOpenContact={id => { setSubTab('contacts'); setOpenContactId(id) }}
            onPickContact={() => setSubTab('contacts')}
            // ONE-CLICK-COUPLE-1: the customer's full contact list (already available here)
            // plus the ids the section needs to write the coupling itself.
            // ONE-CLICK-COUPLE-2: onAddContact closes the no-match dead end (create the
            // missing contact, then couple it) — same prop this component already receives.
            contacts={contacts} customerId={customerId} locationId={l.id as Id} onAddContact={onAddContact} />

          {/* LOCATIE-OMSCHRIJVING-1 (Danny 02-08, order overruled same day): mirrors the
              Bedrijf tab exactly — OverviewTab puts its own description directly under
              Contact (OverviewTab.tsx:162), so this moved from FIRST (this morning's
              placement, ahead of the field tables) to right here, after
              LocationContactSection, same as Bedrijf's Gegevens → Adres → Contact →
              Bedrijfstekst sequence. */}
          <EditableRichTextField label={t('locations.detail.description')} value={l.description ?? ''} onSave={saveDescription} />

          {/* Koios advice, in the same slot the customer's Bedrijf tab puts it: right after
              the fields/contact/description block and BEFORE Vestiging (Danny 02-08: "Koios
              adviseert staat opeens onder vestiging??" — it had drifted below
              LocationBranchSection). Pure FE heuristics over this location's OWN
              completeness — no API call. */}
          <KoiosAdviceBlock namespace="customers" insights={buildLocationAdviceInsights(l, t)} />

          {/* Vestiging — which of OUR branches this site works under, and whether that is
              inherited from the customer or set here on purpose (LOCATIE-VESTIGING-1). */}
          <LocationBranchSection
            branchIds={l.branchIds} branches={l.branches}
            inherited={l.branchInherited} effectiveBranches={l.effectiveBranches}
            options={branchOptions}
            onChange={ids => onSave(l.id as Id, { branchIds: ids })} />
        </div>
      )}

      {/* The SAME panel the customer's Afdelingen tab renders — one department surface. */}
      {subTab === 'departments' && (
        <DepartmentsPanel scope="location" scopeId={l.id as Id} scopeName={l.name}
          customerId={customerId} customerName={customerName}
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

      {/* SCOPED-LIST-TAB-1: read-only, opens the real vacancy/match on row-click. */}
      {subTab === 'vacancies' && (
        <ScopedVacanciesTab scope="location" id={l.id as Id} customerId={customerId} customerName={customerName} scopeName={l.name} />
      )}
      {/* SOLLICITATIES-SCOPE-1: LocationSollicitatiesTab (below) owns step 1 (vacancy id
          resolution) — mounting it only here, not unconditionally in this component,
          keeps useScopedVacancyIds' react-query call out of every OTHER sub-tab/caller
          that never opens this one (no QueryClientProvider needed for those). */}
      {subTab === 'applications' && <ScopedSollicitatiesTab scope="location" id={l.id as Id} />}
      {subTab === 'matches' && <ScopedMatchesTab scope="location" id={l.id as Id} customerId={customerId} />}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_location" values={l.customFields ?? {}}
          onSave={patch => onSave(l.id as Id, { customFields: { ...l.customFields, ...patch } })} />
      )}

      {subTab === 'koppelingen' && (
        <BackofficeLinksTab entity="locations" id={l.id as Id} helloflexLink={l.helloflexLink} shiftmanagerLink={l.shiftmanagerLink} canLink={canLinkBackoffice}>
          {/* PDOK sits in Koppelingen, like every other integration (Danny 28-07).
              KLANTLOCATIE-GEOCODE-1 (backend 2026-08-01): the per-site re-geocode route
              now exists, so this card ACTS as well as reads — mirroring the customer's
              own card verbatim (CustomerDrawer, /customers/{id}/geocode), same shared
              GeocodeButton, same customers.update gate, same `disabled` rule.
              The route is addressed THROUGH the customer, so without a customerId there
              is nothing to POST to and the endpoint is left off — the card then stays
              honestly read-only rather than firing a /customers/undefined/… 404 (§3).
              HelloFlex/Shiftmanager gate themselves on the tenant's connector apps,
              which is why Yesway sees Shiftmanager and not HelloFlex. */}
          <PdokCard lat={l.lat} lng={l.lng} permission="customers.update"
            endpoint={customerId ? `/customers/${customerId}/locations/${l.id}/geocode` : undefined}
            disabled={!l.city} />
        </BackofficeLinksTab>
      )}

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ location_id: l.id }} />
        </SectionCard>
      )}
      {dialog}
      <InUseCountsDialog open={blockedCounts != null} counts={blockedCounts ?? {}} onClose={() => setBlockedCounts(null)} />
    </div>
  )
}

