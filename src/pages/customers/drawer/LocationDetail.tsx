/**
 * LocationDetail — the Locaties-tab drill-down (Danny 13/7, verbatim: "…de
 * naam niets???" — i.e. "can't change anything, not even the name???").
 * Fully editable via the shared EditableFieldTable house
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
import SectionCard from '@/components/ui/SectionCard'
import SubTabBar from '@/components/drawer/SubTabBar'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import SubEntityMergeFooter from './SubEntityMergeFooter'
import SubEntityPanelWrapper from './SubEntityPanelWrapper'
import { getCountryOptions } from '@/lib/countries'
import { useProvinces } from '@/hooks/useProvinces'
import { useDateFormat } from '@/lib/datetime'
// JOB-STATUS-1 (Danny 28-07, verbatim: "…moet hier!!" — i.e. "location
// status must be here!!") — the read-only title-row badge (§3A(c))
// + its own inline picker, extracted into a shared
// component (§0.3 split, 2026-08-03 — see that file's own docblock).
import SubEntityStatusTitleRow from './SubEntityStatusTitleRow'
// K4BLOGO: the location's own real (non-fake) logo upload — see its own docblock.
import LocationLogoAvatar from './LocationLogoAvatar'
// §0.3 split (this task): the pager/changelog/merge/archive/delete cluster, shared
// with DepartmentDetail — see that component's own docblock.
import SubEntityTitleActions from './SubEntityTitleActions'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import { useConfirm } from '@/hooks/useConfirm'
import DepartmentsPanel from './DepartmentsPanel'
import ContactsPanel from './ContactsPanel'
// §0.3 split (this task): the "Adres & gegevens" sub-tab body, extracted so this
// file stays under the ~450-line trigger (§3) once the four ARCHIVE-SUBENTITY-1/
// LOCATIE-SAMENVOEGEN-1/
// TAKEN-OP-LOCATIE-1/
// LOC-DEPT-CHANGELOG-1 features landed.
import LocationAddressTab from './LocationAddressTab'
// §0.3 split (K-SIZE-SPLIT-A): the scoped-list sub-tab bodies (vacancies through
// links), extracted the same way DepartmentSubTabPanels was split off DepartmentDetail.
import LocationSubTabPanels from './LocationSubTabPanels'
import { useLocations } from '@/lib/useLocations'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import { useCustomFields } from '@/lib/useCustomFields'
// SOLLICITATIES-SCOPE-1 (Danny asked 3x at customer level, then again here): the
// location's own Sollicitaties sub-tab — reuses the shared CustomerApplicationsList
// (its `vacancyIds` mode) fed by this location's OWN vacancy ids.
// SUBENTITEIT-DELETE-1: the honest disabled-trash + 409-race counts dialog,
// shared with DepartmentDetail (DRY round 11, CUSTTABS2).
// Delete handler pattern, shared with DepartmentDetail (clone [2]).
import { handleSubEntityDelete } from '../hooks/subEntityDelete'
// Shared SubTabBar tab-list shape, joined by DepartmentDetail/ContactDetail (DRY round 11, CUSTDETAIL).
// scopedSubEntityTabs: the ten scoped entries, joined by DepartmentDetail (DRY round 11, CUSTTABS2).
import { buildSubEntityTabs, scopedSubEntityTabs, subEntityTailTabs } from '../hooks/subEntityTabs'
// Shared merge-modal onClose/onMerged wiring, joined by DepartmentDetail (DRY round 11, CUSTDETAIL).
// Shared department-mutation callback prop shape, also used by LocationsTab (DRY round 11, CUSTDETAIL).
import type { DepartmentCallbacks } from '../hooks/departmentCallbacks'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import { archiveLocation, restoreLocation } from '../hooks/useCustomerLocations'
import { useSubEntityArchive } from '../hooks/useSubEntityArchive'
import type { LocationPayload, LocationUpdateFailure } from '../hooks/useCustomerLocations'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { DeleteResult } from '../hooks/subEntityDelete'

interface Props extends DepartmentCallbacks {
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
  // K-283: widened from `=> void` (mirrors onDelete/onAddContact above) — the real
  // useCustomerLocations().update resolves Location | LocationUpdateFailure, and the
  // branch field below needs that to revert optimistically + show a 403 notice.
  onSave: (id: Id, payload: Partial<LocationPayload>) => void | Promise<Location | LocationUpdateFailure | undefined>
  // SUBENTITEIT-DELETE-1: widened from `=> void` — see DepartmentDetail's identical
  // comment for why the existing `(id) => void`-typed callers stay compatible.
  onDelete: (id: Id) => void | Promise<DeleteResult>
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
  /** ARCHIVE-SUBENTITY-1/LOCATIE-SAMENVOEGEN-1: called with the SURVIVOR's id after
   * a merge, so the host (LocationsTab) can switch the open record to it. */
  onMerged?: (survivorId: Id) => void
  close: () => void
}

// The location drill-down: its own field editing, department/contact sub-sections,
// merge and prev/next paging through the caller's filtered row set.
export default function LocationDetail({
  location: l, customerId, customerName, locations, departments, contacts, statuses, departmentStatuses, contactStatuses, canLinkBackoffice = false,
  onSave, onDelete, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact, onRemoveContact,
  backLabel, pager, onMerged, close,
}: Props) {
  // SOLLICITATIES-SCOPE-1: 'applications' is also declared here so the new sub-tab's
  // `t('applications:title')` resolves without relying on cross-namespace fallback.
  const { t, i18n } = useTranslation(['customers', 'applications'])
  const { formatDate } = useDateFormat()

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
  // ARCHIVE-SUBENTITY-1/LOCATIE-SAMENVOEGEN-1: both are permission-gated in the UI
  // (customers.update — the routes' own middleware; the backend re-checks, §7).
  const canUpdate = (auth?.hasPermission ?? (() => false))('customers.update')
  const [merging, setMerging] = useState(false)
  // The Extra sub-tab only shows when the tenant has defined customer_location custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_location')
  // Sub-tabs (short labels, Danny 2026-07-14) — default Adres & gegevens. Each
  // EditableFieldTable below manages its own uncontrolled edit toggle (they no
  // longer share one global pencil now that they live on separate sub-tabs).
  // SCOPED-LIST-TAB-1 added vacancies/matches. SOLLICITATIES-SCOPE-1 added
  // 'applications'. TAKEN-OP-LOCATIE-1
  // added 'tasks' (KLANTLOCATIE-TAAK-1 — the
  // WORKLIST note about "no location Taken ("Tasks") tab" is now superseded by that ticket).
  // NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1 added 'notes'/'documents', right after 'applications'.
  // TIJDLIJN-SUBDRILL-1: 'timeline' second-to-last, before 'links'.
  // K-288: 'linkedNotes' added right after 'notes' — the linked-notes feed's own sub-tab.
  const [subTab, setSubTab] = useState<'address' | 'departments' | 'contacts' | 'vacancies' | 'applications' | 'notes' | 'linkedNotes' | 'documents' | 'matches' | 'opportunities' | 'tasks' | 'extra' | 'timeline' | 'links'>('address')

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  // SUBENTITEIT-DELETE-1: awaits the hook's DeleteResult — only close on a real
  // success; a 409 race opens the counts dialog instead of closing over nothing.
  const remove = () => confirm(t('locations.detail.confirmDelete'), () => {
    handleSubEntityDelete(onDelete, l.id as Id, close, setBlockedCounts)
  }, { danger: true })

  // ARCHIVE-SUBENTITY-1: the shared mutation hook (§11 — mirrors DepartmentDetail/
  // ContactDetail's identical wiring). No confirm from the 409-race dialog's own
  // "Archiveer" escape (the user already explicitly chose that path); the
  // title-row button confirms first via doArchive below.
  const { archiving, archiveNow, doRestore } = useSubEntityArchive({
    customerId, id: l.id as Id, archiveFn: archiveLocation, restoreFn: restoreLocation, onDone: close,
    archiveFailedMessage: t('locations.detail.archiveFailed'), restoreFailedMessage: t('locations.detail.restoreFailed'),
  })
  const doArchive = () => confirm(t('locations.detail.confirmArchive', { name: l.name }), archiveNow)

  // The SAME panel the customer's Afdelingen tab renders — one department surface.
  // One element, rendered at both the department-open early return below and the
  // Afdelingen sub-tab body.
  // Same twice-rendered panel as departmentsPanel below (DRY round 11, CUSTDETAIL): one element for
  // the contact-open early return and the Contactpersonen sub-tab, byte-identical at both sites.
  const contactsPanel = (
    <ContactsPanel scope="location" scopeId={l.id as Id} scopeName={l.name} customerId={customerId} contacts={contacts} locations={locations}
      openId={openContactId} onOpenChange={setOpenContactId} trail={[{ label: backLabel ?? '', onClick: close }]}
      onRemove={onRemoveContact}
      departments={departments} statuses={contactStatuses} onAdd={onAddContact} onUpdate={onUpdateContact} />
  )
  const departmentsPanel = (
    <DepartmentsPanel scope="location" scopeId={l.id as Id} scopeName={l.name}
      customerId={customerId} customerName={customerName}
      departments={departments} locations={locations} contacts={contacts}
      statuses={departmentStatuses} contactStatuses={contactStatuses}
      openId={openDepartmentId} onOpenChange={setOpenDepartmentId}
      trail={[{ label: backLabel ?? '', onClick: close }]}
      onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onRemove={onRemoveDepartment}
      onAddContact={onAddContact} onUpdateContact={onUpdateContact} onRemoveContact={onRemoveContact} />
  )

  // A contact opened from this location's own list takes over the whole body: it brings
  // its own breadcrumb (i.e. "Locations › this branch › the person"), so
  // showing the location's
  // title, sub-tab bar and delete button underneath would mean two titles and two delete
  // buttons with different blast radii on one narrow panel.
  if (departmentOpen) {
    return <SubEntityPanelWrapper>{departmentsPanel}</SubEntityPanelWrapper>
  }

  if (contactOpen) {
    return <SubEntityPanelWrapper>{contactsPanel}</SubEntityPanelWrapper>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* One way back per level: the shared trail replaces SubEntityTab's own button. */}
      <DrillBreadcrumb trail={[{ label: backLabel ?? '', onClick: close }]} current={l.name} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* K4BLOGO: real upload — the backend persists + serves it via a signed URL. */}
          <LocationLogoAvatar customerId={customerId} locationId={l.id as Id} logoUrl={l.logoUrl} name={l.name} canUpdate={canUpdate} />
          {/* JOB-STATUS-1: name + reference chip + status badge/picker, extracted
              into a shared component (§0.3 split, 2026-08-03 — also adopted by
              DepartmentDetail, which carried a near-verbatim copy of this block). */}
          <SubEntityStatusTitleRow id={l.id as Id} name={l.name} referenceNumber={l.referenceNumber}
            statusId={l.statusId} statusLabel={l.statusLabel} statusColor={l.statusColor}
            statusOptions={statusOptions} onSave={onSave} />
        </div>
        {/* §0.3 split: the pager/changelog/merge/archive/delete cluster is the shared
            SubEntityTitleActions (mirrors DepartmentDetail verbatim). Merge/archive are
            hidden without customers.update; merge also needs a second location to merge
            with (§3 — no fake affordance). */}
        <SubEntityTitleActions
          pager={pager}
          changelogEndpoint={customerId != null ? `/customers/${customerId}/locations/${l.id}/activity` : undefined}
          onMerge={canUpdate && locations.length > 1 ? () => setMerging(true) : undefined}
          mergeTitle={t('locations.detail.mergeLocation')}
          onArchive={canUpdate && !l.archived ? doArchive : undefined}
          archiveTitle={t('locations.detail.archiveLocation')}
          archiving={archiving}
          onDelete={remove}
          deleteDisabled={l.inUse}
          deleteTitle={l.inUse ? t('locations.deleteInUse') : t('locations.detail.deleteLocation')}
        />
      </div>

      {/* ARCHIVE-SUBENTITY-1: the in-body archived state (§3A — mirrors the vacancy/
          candidate drawer's ArchivedBanner verbatim), right under the title row. */}
      {l.archived && (
        <ArchivedBanner id={l.id} onRestore={doRestore}
          message={l.archivedAt ? t('locations.archivedBanner.since', { date: formatDate(l.archivedAt) }) : t('locations.archivedBanner.flag')}
          restoreLabel={t('locations.archivedBanner.restore')} />
      )}

      {/* Sub-tab strip — same shared bar as the candidate Communicatie tab; short labels.
          Tab list built by the shared buildSubEntityTabs (DRY round 11, CUSTDETAIL); the
          scoped entries are the shared scopedSubEntityTabs (DRY round 11, CUSTTABS2) — this
          location prepends its own leading 'departments' entry (a department has none) —
          same shape as DepartmentDetail/ContactDetail's own call, see that helper's doc comment. */}
      <SubTabBar
        tabs={buildSubEntityTabs({
          first: { id: 'address', label: t('locations.detail.addressTitle') },
          scoped: [{ id: 'departments', label: t('drawer.tabs.departments') }, ...scopedSubEntityTabs(t, customFieldDefs)],
          // TIJDLIJN-SUBDRILL-1/DD-FE-6: the shared tail. EXTRACT-1: a location shows
          // Koppelingen ALWAYS (§3A/§11), unlike Department/ContactDetail.
          ...subEntityTailTabs(t, { hasCustomer: customerId != null, showLinks: true }),
        })}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {/* Adres & gegevens — no repeated title (it would duplicate the sub-tab label).
          §0.3 split: the whole sub-tab body now lives in LocationAddressTab. */}
      {subTab === 'address' && (
        <LocationAddressTab location={l} customerId={customerId} contacts={contacts} t={t}
          provinceOptions={provinceOptions} countryOptions={countryOptions} branchOptions={branchOptions}
          onSave={onSave} onAddContact={onAddContact}
          onGoToContacts={id => { setSubTab('contacts'); if (id != null) setOpenContactId(id) }} />
      )}

      {subTab === 'departments' && departmentsPanel}

      {subTab === 'contacts' && contactsPanel}

      {/* §0.3 split (K-SIZE-SPLIT-A): vacancies/applications/notes/linkedNotes/
          documents/matches/opportunities/tasks/extra/timeline/links all live in
          the shared LocationSubTabPanels now (mirrors DepartmentSubTabPanels). */}
      <LocationSubTabPanels subTab={subTab} location={l} customerId={customerId} customerName={customerName}
        canLinkBackoffice={canLinkBackoffice} onSave={onSave} t={t} />

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ location_id: l.id }} />
        </SectionCard>
      )}
      {/* LOCATIE-SAMENVOEGEN-1 — `others` is the customer-wide location list (already
          available as a prop), never a fresh search endpoint (see the modal's own doc).
          Shared SubEntityMergeFooter (DRY round, CANDTABS). */}
      <SubEntityMergeFooter scope="location" customerId={customerId}
        merging={merging} setMerging={setMerging} onMerged={onMerged}
        current={{ id: l.id as Id, name: l.name }}
        others={locations.map(x => ({ id: x.id, name: x.name }))}
        dialog={dialog} blockedCounts={blockedCounts} setBlockedCounts={setBlockedCounts}
        archiveNow={archiveNow} archiving={archiving} />
    </div>
  )
}

