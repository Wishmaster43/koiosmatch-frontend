/**
 * CustomerDrawerTabPanels — renders the active top-level customer drawer tab
 * body (overview/locations/departments/contacts/vacancies/matches/
 * opportunities/planning/timeline/statistics/priceAgreements/documents/
 * communication/extra/koppelingen). §0.3 split (K-SIZE-SPLIT-A, mechanical
 * extraction, no behavior change) — lifted verbatim out of CustomerDrawer.tsx's
 * own `renderTab` switch, which pushed that thin-container file over the
 * ~400-line split trigger (§3). Pure presentational dispatch: all data/hooks
 * stay owned by CustomerDrawer (§3A — drawers stay thin containers).
 */
import OverviewTab from './OverviewTab'
import LocationsTab from './LocationsTab'
import DepartmentsTab from './DepartmentsTab'
import ContactsTab from './ContactsTab'
import VacanciesTab from './VacanciesTab'
import MatchesTab from './MatchesTab'
import OpportunitiesTab from './OpportunitiesTab'
import PlanningTab from './PlanningTab'
import StatisticsTab from './StatisticsTab'
import DocumentsTab from './DocumentsTab'
import PriceAgreementsTab from './PriceAgreementsTab'
import CustomerNotesTab from './CustomerNotesTab'
import ChangelogTab from './ChangelogTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import PdokCard from '@/components/drawer/PdokCard'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'
import type { useCustomerLocations } from '../hooks/useCustomerLocations'
import type { useCustomerDepartments } from '../hooks/useCustomerDepartments'
import type { useCustomerContacts } from '../hooks/useCustomerContacts'

type NotePayload = { type: string; title: string; body: string; language?: string }

export default function CustomerDrawerTabPanels({
  id, c, setActiveTab,
  locationsApi, departmentsApi, contactsApi,
  statuses, locationOptions, locationStatuses, departmentStatuses, contactStatuses,
  canLinkBackoffice, authorInitials,
  locationNames, departmentNames, contactNames,
  onUpdate, onAddNote, onEditNote, onDeleteNote, onFetchPreviousVersion, onRestorePreviousNote,
}: {
  id: string
  c: Customer
  setActiveTab?: (id: string) => void
  locationsApi: ReturnType<typeof useCustomerLocations>
  departmentsApi: ReturnType<typeof useCustomerDepartments>
  contactsApi: ReturnType<typeof useCustomerContacts>
  statuses: { value: string; label: string }[]
  locationOptions: { id: Id; name: string }[]
  locationStatuses: { value: string; label: string }[]
  departmentStatuses: { value: string; label: string }[]
  contactStatuses: { value: string; label: string }[]
  canLinkBackoffice: boolean
  authorInitials: string
  locationNames: Record<string, string>
  departmentNames: Record<string, string>
  contactNames: Record<string, string>
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void | Promise<boolean>
  onAddNote?: (id: Id | undefined, payload: NotePayload) => void
  onEditNote?: (id: Id | undefined, noteId: Id | undefined, payload: NotePayload) => void
  onDeleteNote?: (id: Id | undefined, noteId: Id | undefined) => void
  onFetchPreviousVersion?: (id: Id | undefined, noteId: Id | undefined) => Promise<{ previous_body: string | null; previous_saved_at: string | null } | null>
  onRestorePreviousNote?: (id: Id | undefined, noteId: Id | undefined) => Promise<boolean>
}) {
  switch (id) {
    case 'overview':      return <OverviewTab c={c} onSave={v => onUpdate?.(c.id, v)} statuses={statuses} />
    case 'locations':     return (
      <LocationsTab
        customerId={c.id} customerName={c.name} locations={locationsApi.locations} departments={departmentsApi.departments} contacts={contactsApi.contacts}
        statuses={locationStatuses} departmentStatuses={departmentStatuses} contactStatuses={contactStatuses}
        canLinkBackoffice={canLinkBackoffice}
        onAddLocation={locationsApi.add}
        onSaveLocation={locationsApi.update} onDeleteLocation={locationsApi.remove}
        onAddDepartment={(payload, locName) => departmentsApi.add(payload, locName)}
        onUpdateDepartment={(id2, payload, locName) => departmentsApi.update(id2, payload, locName)}
        onRemoveDepartment={departmentsApi.remove}
        onAddContact={contactsApi.add} onUpdateContact={contactsApi.update} onRemoveContact={contactsApi.remove}
      />
    )
    case 'departments':   return (
      <DepartmentsTab
        customerId={c.id} customerName={c.name} departments={departmentsApi.departments} contacts={contactsApi.contacts} locations={locationOptions} statuses={departmentStatuses}
        canLinkBackoffice={canLinkBackoffice}
        onAdd={departmentsApi.add} onUpdate={departmentsApi.update} onRemove={departmentsApi.remove}
        contactStatuses={contactStatuses}
        onAddContact={contactsApi.add} onUpdateContact={contactsApi.update} onRemoveContact={contactsApi.remove}
      />
    )
    case 'contacts':      return (
      <ContactsTab
        contacts={contactsApi.contacts} locations={locationOptions} departments={departmentsApi.departments} statuses={contactStatuses}
        canLinkBackoffice={canLinkBackoffice}
        onAdd={contactsApi.add} onUpdate={contactsApi.update} onRemove={contactsApi.remove}
      />
    )
    case 'vacancies':     return <VacanciesTab customerId={c.id} customerName={c.name} />
    case 'matches':       return <MatchesTab customerId={c.id} />
    case 'opportunities': return <OpportunitiesTab customerId={c.id} customerName={c.name} />
    case 'planning':      return <PlanningTab customerId={c.id ?? ''} />
    // TIJDLIJN-OVERAL (27-08): same content component the title-row changelog
    // popover uses (mixed customer + sub-entity feed).
    case 'timeline':      return <ChangelogTab customerId={c.id} locationNames={locationNames} departmentNames={departmentNames} contactNames={contactNames} />
    case 'statistics':    return <StatisticsTab c={c} onGoToVacancies={() => setActiveTab?.('vacancies')} />
    case 'priceAgreements': return <PriceAgreementsTab customerId={c.id} c={c} onSave={v => onUpdate?.(c.id, v)} />
    // DOCS-LOC-DEPT-1: the customer's own locations/departments enable the
    // "gekoppeld aan" upload picker inside DocumentsTab (§3A — the customer-level
    // documents tab is the only unlocked one; ScopedDocumentsTab locks its own).
    case 'documents':     return <DocumentsTab customerId={c.id} locations={locationsApi.locations} departments={departmentsApi.departments} />
    case 'communication': return (
      <CustomerNotesTab
        customerId={c.id} customerName={c.name} customerInitials={c.initials}
        authorInitials={authorInitials}
        notes={c.notes ?? []}
        onAddNote={payload => onAddNote?.(c.id, payload)}
        onEditNote={(noteId, payload) => onEditNote?.(c.id, noteId, payload)}
        onDeleteNote={noteId => onDeleteNote?.(c.id, noteId)}
        onFetchPreviousVersion={onFetchPreviousVersion ? (noteId: Id | undefined) => onFetchPreviousVersion(c.id, noteId) : undefined}
        onRestorePreviousNote={onRestorePreviousNote ? (noteId: Id | undefined) => onRestorePreviousNote(c.id, noteId) : undefined}
        c={c} onSave={v => onUpdate?.(c.id, v)}
      />
    )
    case 'extra':         return (
      <CustomFieldsTab entityType="customer" values={c.customFields ?? {}}
        onSave={patch => onUpdate?.(c.id, { customFields: { ...c.customFields, ...patch } })} />
    )
    case 'koppelingen':   return (
      <BackofficeLinksTab entity="customers" id={c.id as Id} helloflexLink={c.helloflexLink} shiftmanagerLink={c.shiftmanagerLink} canLink={canLinkBackoffice}>
        {/* PDOK moved out of the title row into this tab (Danny 28-07). Disabled when
            there is no city yet — the customer's own address is city-only here.
            lat/lng were never passed (CMBE 04-08) — the card decides "geocoded" on
            them, so this ALWAYS said "nog niet gegecodeerd" regardless of the data. */}
        <PdokCard lat={c.lat} lng={c.lng} endpoint={`/customers/${c.id}/geocode`} permission="customers.update" disabled={!c.city} />
      </BackofficeLinksTab>
    )
    default: return null
  }
}
