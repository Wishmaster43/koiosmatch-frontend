/**
 * DepartmentSubTabPanels — the scoped-list sub-tab bodies of DepartmentDetail
 * (vacancies/applications/notes/documents/matches/opportunities/tasks/extra/
 * links). §0.3 split (2026-08-28, mechanical extraction, no behavior change) —
 * lifted verbatim out of DepartmentDetail.tsx, which was over the ~400-line
 * split trigger (§3). "data" and "contacts" stay in DepartmentDetail itself
 * (data has its own DepartmentDataTab extraction; contacts is also rendered
 * from the contactOpen early-return branch, so it stays with its sibling).
 * See DepartmentDetail's own docblock for the history behind every comment
 * kept below (SCOPED-LIST-TAB-1, SOLLICITATIES-SCOPE-1, TAKEN-OP-AFDELING-1, …).
 */
import ScopedVacanciesTab from './ScopedVacanciesTab'
import ScopedApplicationsTab from './ScopedApplicationsTab'
import ScopedNotesTab from './ScopedNotesTab'
import ScopedDocumentsTab from './ScopedDocumentsTab'
import ScopedMatchesTab from './ScopedMatchesTab'
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'

type Tx = (key: string, opts?: Record<string, unknown>) => string
export type DepartmentSubTab = 'data' | 'contacts' | 'vacancies' | 'applications' | 'notes' | 'documents' | 'matches' | 'opportunities' | 'tasks' | 'extra' | 'links'

// Renders the active non-data, non-contacts sub-tab body for DepartmentDetail.
export default function DepartmentSubTabPanels({ subTab, department, customerId, customerName, canLinkBackoffice, showKoppelingen, onSave, t }: {
  subTab: DepartmentSubTab
  department: Department
  customerId?: Id
  customerName?: string
  canLinkBackoffice: boolean
  showKoppelingen: boolean
  onSave: (id: Id, payload: Record<string, unknown>) => void
  t: Tx
}) {
  return (
    <>
      {/* SCOPED-LIST-TAB-1: read-only, opens the real vacancy/match on row-click. */}
      {subTab === 'vacancies' && (
        <ScopedVacanciesTab scope="department" id={department.id as Id}
          customerId={customerId} customerName={customerName} scopeName={department.name} />
      )}
      {/* SOLLICITATIES-SCOPE-1: DepartmentSollicitatiesTab (below) owns step 1 (vacancy id
          resolution) — mounting it only here, not unconditionally in this component,
          keeps useScopedVacancyIds' react-query call out of every OTHER sub-tab/caller
          that never opens this one (no QueryClientProvider needed for those). */}
      {subTab === 'applications' && <ScopedApplicationsTab scope="department" id={department.id as Id} />}
      {/* NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: this department's own Notities/Documenten
          — a department is a LEAF, so neither scoped fetch adds a rollup param
          (mirrors LocationDetail's identical wiring, minus the rollup). */}
      {subTab === 'notes' && <ScopedNotesTab scope="department" id={department.id as Id} customerId={customerId} />}
      {subTab === 'documents' && <ScopedDocumentsTab scope="department" id={department.id as Id} customerId={customerId} />}
      {subTab === 'matches' && <ScopedMatchesTab scope="department" id={department.id as Id} customerId={customerId} />}
      {/* SCOPED-LIST-TAB-1: read-only, opens the real opportunity on row-click.
          OPP-MODAL-PREFILL-1: customerName rides along too, for the "+ Kans"
          modal's customer-picker option label (mirrors ScopedVacanciesTab above). */}
      {subTab === 'opportunities' && <ScopedOpportunitiesTab scope="department" id={department.id as Id} customerId={customerId} customerName={customerName} />}
      {/* TAKEN-OP-AFDELING-1: own scoped label block (mirrors contacts.tasks.*) —
          the shared tab's CURRENT labels interface (newTask/searchPlaceholder/empty/
          loading/error/openTask); re-check this call site if EntityTasksTab's
          interface changes again before this lands. */}
      {subTab === 'tasks' && (
        <EntityTasksTab linkType="department" id={department.id as Id} labels={{
          newTask: t('departments.detail.tasks.newTask'),
          searchPlaceholder: t('departments.detail.tasks.searchPlaceholder'),
          empty: t('departments.detail.tasks.empty'),
          loading: t('departments.detail.tasks.loading'),
          error: t('departments.detail.tasks.error'),
          openTask: t('departments.detail.tasks.openTask'),
        }} />
      )}

      {subTab === 'extra' && (
        <CustomFieldsTab entityType="customer_department" values={department.customFields ?? {}}
          onSave={patch => onSave(department.id as Id, { customFields: { ...department.customFields, ...patch } })} />
      )}

      {subTab === 'links' && showKoppelingen && (
        <BackofficeLinksTab entity="departments" id={department.id as Id} helloflexLink={department.helloflexLink} shiftmanagerLink={department.shiftmanagerLink} canLink={canLinkBackoffice} />
      )}
    </>
  )
}
