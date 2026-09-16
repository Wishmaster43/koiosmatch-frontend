/**
 * LocationSubTabPanels — the scoped-list sub-tab bodies of LocationDetail
 * (vacancies/applications/notes/linkedNotes/documents/matches/opportunities/
 * tasks/extra/timeline/links). §0.3 split (K-SIZE-SPLIT-A, mechanical
 * extraction, no behavior change) — lifted verbatim out of LocationDetail.tsx,
 * which was over the ~400-line split trigger (§3), mirroring
 * DepartmentSubTabPanels. "address", "departments" and "contacts" stay in
 * LocationDetail itself (address has its own LocationAddressTab extraction;
 * departments/contacts are also rendered from the departmentOpen/contactOpen
 * early-return branches, so they stay with their siblings).
 * See LocationDetail's own docblock for the history behind every comment
 * kept below (SCOPED-LIST-TAB-1, SOLLICITATIES-SCOPE-1, TAKEN-OP-LOCATIE-1, …).
 */
import ScopedVacanciesTab from './ScopedVacanciesTab'
import ScopedApplicationsTab from './ScopedApplicationsTab'
import ScopedNotesTab from './ScopedNotesTab'
// K-288: linked-notes feed moved out of ScopedNotesTab into its own sub-tab.
import LinkedNotesTab from '@/components/drawer/tabs/notes/LinkedNotesTab'
import ScopedDocumentsTab from './ScopedDocumentsTab'
import ScopedMatchesTab from './ScopedMatchesTab'
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
// TIJDLIJN-SUBDRILL-1: the location's own activity log (LOC-DEPT-CHANGELOG-1).
import SubEntityTimelineTab from './SubEntityTimelineTab'
import GeocodeCard from '@/components/drawer/GeocodeCard'
import type { Location } from '@/types/customer'
import type { Id } from '@/types/common'

type Tx = (key: string, opts?: Record<string, unknown>) => string
// K-288: 'linkedNotes' added right after 'notes' — the linked-notes feed's own sub-tab.
export type LocationSubTab = 'address' | 'departments' | 'contacts' | 'vacancies' | 'applications' | 'notes' | 'linkedNotes' | 'documents' | 'matches' | 'opportunities' | 'tasks' | 'extra' | 'timeline' | 'links'

// Renders the active non-address, non-departments, non-contacts sub-tab body for LocationDetail.
export default function LocationSubTabPanels({ subTab, location: l, customerId, customerName, canLinkBackoffice, onSave, t }: {
  subTab: LocationSubTab
  location: Location
  customerId?: Id
  customerName?: string
  canLinkBackoffice: boolean
  onSave: (id: Id, payload: Record<string, unknown>) => void
  t: Tx
}) {
  return (
    <>
      {/* SCOPED-LIST-TAB-1: read-only, opens the real vacancy/match on row-click. */}
      {subTab === 'vacancies' && (
        <ScopedVacanciesTab scope="location" id={l.id as Id} customerId={customerId} customerName={customerName} scopeName={l.name} />
      )}
      {/* SOLLICITATIES-SCOPE-1: LocationSollicitatiesTab (below) owns step 1 (vacancy id
          resolution) — mounting it only here, not unconditionally in this component,
          keeps useScopedVacancyIds' react-query call out of every OTHER sub-tab/caller
          that never opens this one (no QueryClientProvider needed for those). */}
      {subTab === 'applications' && <ScopedApplicationsTab scope="location" id={l.id as Id} />}
      {/* NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: this site's own Notities/Documenten,
          read through the scoped GET endpoints (with ?rollup=1 folding in its
          departments' notes/documents — a department is a leaf, nothing rolls up
          under it). Mounted only while active, mirrors ScopedApplicationsTab. */}
      {subTab === 'notes' && <ScopedNotesTab scope="location" id={l.id as Id} customerId={customerId} />}
      {/* K-288: notes written elsewhere in the chain that name this location as
          principal (NOTITIE-DOORLINK-1) — now its own sub-tab, right after Notities. */}
      {subTab === 'linkedNotes' && customerId != null && (
        <LinkedNotesTab entity="customers" id={customerId} sub={{ kind: 'locations', id: l.id as Id }} />
      )}
      {subTab === 'documents' && <ScopedDocumentsTab scope="location" id={l.id as Id} customerId={customerId} />}
      {subTab === 'matches' && <ScopedMatchesTab scope="location" id={l.id as Id} customerId={customerId} />}
      {/* SCOPED-LIST-TAB-1: read-only, opens the real opportunity on row-click.
          OPP-MODAL-PREFILL-1: customerName rides along too, for the "+ Kans"
          modal's customer-picker option label (mirrors ScopedVacanciesTab above). */}
      {subTab === 'opportunities' && <ScopedOpportunitiesTab scope="location" id={l.id as Id} customerId={customerId} customerName={customerName} />}
      {/* TAKEN-OP-LOCATIE-1: own scoped label block (mirrors DepartmentDetail's
          identical wiring) — the shared tab's CURRENT labels interface. */}
      {subTab === 'tasks' && (
        <EntityTasksTab linkType="customer_location" id={l.id as Id} labels={{
          newTask: t('locations.detail.tasks.newTask'),
          searchPlaceholder: t('locations.detail.tasks.searchPlaceholder'),
          empty: t('locations.detail.tasks.empty'),
          loading: t('locations.detail.tasks.loading'),
          error: t('locations.detail.tasks.error'),
          openTask: t('locations.detail.tasks.openTask'),
        }} />
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_location" values={l.customFields ?? {}}
          onSave={patch => onSave(l.id as Id, { customFields: { ...l.customFields, ...patch } })} />
      )}

      {subTab === 'timeline' && customerId != null && (
        <SubEntityTimelineTab endpoint={`/customers/${customerId}/locations/${l.id}/activity`} />
      )}

      {subTab === 'links' && (
        <BackofficeLinksTab entity="locations" id={l.id as Id} helloflexLink={l.helloflexLink} shiftmanagerLink={l.shiftmanagerLink} canLink={canLinkBackoffice} refetchUrl={customerId ? `/customers/${customerId}/locations/${l.id}` : undefined}>
          {/* OpenCage geocoding sits in Koppelingen, like every other integration (Danny 28-07).
              KLANTLOCATIE-GEOCODE-1 (backend 2026-08-01): the per-site re-geocode route
              now exists, so this card ACTS as well as reads — mirroring the customer's
              own card verbatim (CustomerDrawer, /customers/{id}/geocode), same shared
              GeocodeButton, same customers.update gate, same `disabled` rule.
              The route is addressed THROUGH the customer, so without a customerId there
              is nothing to POST to and the endpoint is left off — the card then stays
              honestly read-only rather than firing a /customers/undefined/… 404 (§3).
              HelloFlex/Shiftmanager gate themselves on the tenant's connector apps,
              which is why Yesway sees Shiftmanager and not HelloFlex. */}
          {/* GEO-POLL-1: fetchEndpoint is the per-location READ route the poll
              re-fetches until the queued geocode lands — without it the card
              never learns the result and needs a manual reload (the CMD+R bug). */}
          <GeocodeCard lat={l.lat} lng={l.lng} permission="customers.update"
            endpoint={customerId ? `/customers/${customerId}/locations/${l.id}/geocode` : undefined}
            fetchEndpoint={customerId ? `/customers/${customerId}/locations/${l.id}` : undefined}
            disabled={!l.city} />
        </BackofficeLinksTab>
      )}
    </>
  )
}
