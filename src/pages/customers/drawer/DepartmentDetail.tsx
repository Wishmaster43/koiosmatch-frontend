/**
 * DepartmentDetail — the Afdelingen-tab drill-down. Danny 2026-07-14: reorganised
 * into SUB-TABS (short labels, mirrors LocationDetail/the candidate Communicatie
 * sub-tab bar) — Gegevens (name/location/status + the Omschrijving rich-text
 * block) · Contactpersonen — default Gegevens. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, location (movable
 * per CustomerDepartmentController — `location_id` is `sometimes` on update),
 * cost centre (Danny 2026-07-22 — the middle cascade level; billing email
 * stays customer-only, see OverviewTab). Omschrijving is its own rich-text block
 * (EditableRichTextField — own
 * pencil/save/cancel, RichTextEditor + SafeHtml), same pattern as the customer's
 * Teksten section — a bare textarea is no longer the house pattern for prose.
 * Delete asks for confirmation and fails soft (409 = in use) via the hook's own
 * toast. Nested contacts-in-this-department stay read-only here (full contact
 * management lives on the Contactpersonen tab / location detail).
 *
 * PARITY-DEPARTMENT-1 (2026-08-02, Danny: "Afdeling loopt achter — zorg ervoor
 * dat de huisstijl klopt"): brought this drill-down in line with LocationDetail,
 * the §3A reference — reference-number chip + a colour-coded title-row status
 * badge with its own inline picker (JOB-STATUS-1, status removed from the field
 * table), Omschrijving moved ahead of the field table, and a Koios advice block
 * over this department's own fields. The Koios builder lives INLINE below (not a
 * sibling file like locationAiInsights.ts) because this task's scope locks
 * changes to this file + its test only. LocationContactSection/
 * LocationBranchSection (contact block, branch coupling) are deliberately NOT
 * mirrored — a department has no address of its own and the location's contact
 * block is mid-redesign in another lane.
 *
 * NOT mirrored, verified: LocationDetail titles its field cards (group names
 * "Details"/"Adres") even though its own sub-tab is "Adres & gegevens" — a
 * DIFFERENT, compound string, so no collision. This department's sub-tab is the
 * short label `departments.detail.subtabs.data`, which is the SAME string as the
 * candidate group title `overview.details` in nl/en/es ("Gegevens"/"Details"/
 * "Datos" — checked all five locales). Titling this card would duplicate the
 * sub-tab label AND breaks DepartmentsPanel.test.tsx's `getByText` assertion
 * (that file is committed-clean and out of scope here) — so the field table
 * below intentionally keeps `title=""`, unlike the location.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SubTabBar from '@/components/drawer/SubTabBar'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useBackofficeLinksVisible } from '@/components/drawer/useBackofficeLinksVisible'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import MergeSubEntityModal from './MergeSubEntityModal'
// JOB-STATUS-1: name + reference chip + status badge/picker, now the shared
// SubEntityStatusTitleRow (§0.3 split, LocationDetail.tsx 2026-08-03 — this file
// carried a near-verbatim copy of the same block, adopted here in the same pass).
import SubEntityStatusTitleRow from './SubEntityStatusTitleRow'
// §0.3 split (this task): the pager/changelog/merge/archive/delete cluster,
// shared with LocationDetail — see that component's own docblock.
import SubEntityTitleActions from './SubEntityTitleActions'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import ContactsPanel from './ContactsPanel'
import DrillBreadcrumb from '@/components/drawer/DrillBreadcrumb'
import type { DrillPagerProps } from '@/components/drawer/DrillPager'
import type { Crumb } from '@/components/drawer/DrillBreadcrumb'
import EditableRichTextField from './EditableRichTextField'
import { departmentPopoutId } from '@/lib/secondScreen'
// SCOPED-LIST-TAB-1: the department's own Vacatures/Matches sub-tabs (§3A —
// shared config-driven tab, never a forked copy).
import ScopedVacanciesTab from './ScopedVacanciesTab'
import ScopedMatchesTab from './ScopedMatchesTab'
// SCOPED-LIST-TAB-1: this department's own Kansen sub-tab, right after Matches
// (§3A — shared config-driven tab, never a forked copy — mirrors LocationDetail).
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'
// SOLLICITATIES-SCOPE-1 (Danny asked 3x at customer level, then again here): the
// department's own Sollicitaties sub-tab — reuses the shared CustomerApplicationsList
// (its `vacancyIds` mode) fed by this department's OWN vacancy ids.
// TAKEN-OP-AFDELING-1: TaskLinkResolver already knows 'department' (task_links),
// so this is one more <EntityTasksTab linkType="…"> line, never a new component.
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
// SUBENTITEIT-DELETE-1: the honest disabled-trash + 409-race counts dialog.
import InUseCountsDialog from './InUseCountsDialog'
import { useCustomFields } from '@/lib/useCustomFields'
import { useConfirm } from '@/hooks/useConfirm'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import ScopedApplicationsTab from './ScopedApplicationsTab'
// NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: this department's own Notities/Documenten
// sub-tabs (§3A — shared config-driven surfaces, never a forked copy).
import ScopedNotesTab from './ScopedNotesTab'
import ScopedDocumentsTab from './ScopedDocumentsTab'
import { archiveDepartment, restoreDepartment } from '../hooks/useCustomerDepartments'
import { useSubEntityArchive } from '../hooks/useSubEntityArchive'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { DeleteResult } from '../hooks/subEntityDelete'

// A bound-namespace translate function (mirrors locationAiInsights.ts/customerAiInsights.ts).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildDepartmentAdviceInsights — Koios advice for THIS department's own fields
 * (description/status/cost centre; name is required so it carries no signal).
 * Pure FE completeness heuristics, no AI/API call — mirrors
 * buildLocationAdviceInsights next to LocationDetail, kept inline here per the
 * PARITY-DEPARTMENT-1 scope note above.
 */
function buildDepartmentAdviceInsights(d: Department, t: Tx): KoiosAdviceInsight[] {
  const coreFields = [d.description, d.statusId, d.costCenter]
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)
  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.departmentComplete') : t('ai.departmentPartial', { pct: filledPct }),
    },
  ]
}

// One department's own drill-down body: the field-table card, sub-tabs (contacts/vacancies/applications/notes/documents/matches/opportunities/tasks/extra/links) and merge/delete actions — see the prop comments for each sub-tab's own history.
export default function DepartmentDetail({ department, locations, statuses, contactStatuses = [], departments = [], contacts = [], canLinkBackoffice = false, trail = [], pager, onMerged, onAddContact, onUpdateContact, onRemoveContact, onSave, onDelete, close, customerId, customerName }: {
  department: Department
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  // Point 1 (Danny's ten-point round): threaded down from DepartmentsPanel so
  // this department's own ScopedVacanciesTab/ScopedMatchesTab "+" can prefill —
  // this file itself never queries the customer, only passes the id/name on.
  customerId?: Id
  customerName?: string
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
  /** Prev/next stepper through the panel's own filtered rows (DRILL-PAGER-1). */
  pager?: DrillPagerProps
  /** ARCHIVE-SUBENTITY-1/AFDELING-SAMENVOEGEN-1: called with the SURVIVOR's id
   * after a merge, so the host (DepartmentsPanel) can switch to it. */
  onMerged?: (survivorId: Id) => void
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  onRemoveContact: (id: Id) => void
  onSave: (id: Id, payload: Partial<DepartmentPayload>) => void
  // SUBENTITEIT-DELETE-1: the real (useCustomerDepartments) `remove` resolves to a
  // DeleteResult (ok / 409-race-with-counts); widened from `=> void` so this file
  // can react to it — still assignable from the plain `(id) => void` prop type
  // DepartmentsPanel/CustomerDrawer declare (a void-returning function is always
  // assignable where a richer return type is accepted, so neither needs to change).
  onDelete: (id: Id) => void | Promise<DeleteResult>
  close: () => void
}) {
  // SOLLICITATIES-SCOPE-1: 'applications' is also declared here so the new sub-tab's
  // `t('applications:title')` resolves without relying on cross-namespace fallback.
  const { t } = useTranslation(['customers', 'applications'])
  const { formatDate } = useDateFormat()
  // A contact opened from this department's own list takes over the body (see LocationDetail).
  const [openContactId, setOpenContactId] = useState<Id | null>(null)
  const contactOpen = openContactId != null

  const { confirm, dialog } = useConfirm()
  // SUBENTITEIT-DELETE-1: a 409 RACE (something got linked after `inUse` was last
  // read) surfaces the server's own per-relation counts here instead of a blanket toast.
  const [blockedCounts, setBlockedCounts] = useState<Record<string, number> | null>(null)
  const auth = useAuth()
  // ARCHIVE-SUBENTITY-1/AFDELING-SAMENVOEGEN-1: both are permission-gated in the UI
  // (customers.update — the routes' own middleware; the backend re-checks, §7).
  const canUpdate = (auth?.hasPermission ?? (() => false))('customers.update')
  const [merging, setMerging] = useState(false)
  // The Extra sub-tab only shows when the tenant has defined customer_department custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer_department')
  // DD-FE-6 ("no empty tabs"): this file passes no extra children into
  // BackofficeLinksTab, so the Koppelingen sub-tab is genuinely empty (no card,
  // no "Koppelen" button) unless at least one connector app is enabled.
  const showKoppelingen = useBackofficeLinksVisible()
  // Sub-tabs (short labels, Danny 2026-07-14) — default Gegevens. SCOPED-LIST-TAB-1/
  // TAKEN-OP-AFDELING-1 added vacancies/matches/tasks. SOLLICITATIES-SCOPE-1 added
  // 'applications'. NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1 added 'notes'/'documents'.
  const [subTab, setSubTab] = useState<'data' | 'contacts' | 'vacancies' | 'applications' | 'notes' | 'documents' | 'matches' | 'opportunities' | 'tasks' | 'extra' | 'links'>('data')

  // JOB-STATUS-1 (mirrors LocationDetail): status options for the title-row picker.
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  // Description lives in its own rich-text block below (EditableRichTextField), and
  // status now lives in the title-row badge (see render below) — neither is a row
  // in this field-table anymore. Kostenplaats ("Cost centre", Danny 2026-07-22)
  // is the middle cascade level — department, then location, then customer —
  // no billing email here, facturatie ("billing") always comes from the
  // customer (see OverviewTab).
  const fields: FieldRow[] = [
    { key: 'name', label: t('departments.detail.name'), type: 'text' },
    { key: 'locationId', label: t('departments.detail.location'), type: 'select', options: locations.map(l => ({ value: String(l.id), label: l.name })) },
    { key: 'costCenter', label: t('departments.detail.costCenter'), type: 'text' },
  ]

  // The read/edit values keyed like the fields above; locationId compares as a string.
  const values = {
    name: department.name,
    locationId: department.locationId != null ? String(department.locationId) : '',
    costCenter: department.costCenter,
  }

  // Maps the field-table's edited values back onto the specific PATCH fields onSave expects.
  const save = (v: Record<string, unknown>) => {
    onSave(department.id as Id, {
      name: v.name as string, locationId: v.locationId as string,
      costCenter: v.costCenter as string,
    })
  }
  const saveDescription = (html: string) => onSave(department.id as Id, { description: html })

  // SUBENTITEIT-DELETE-1: the confirmed delete awaits the hook's DeleteResult —
  // only close on a real success; a 409 race opens the counts dialog instead of
  // silently closing over a delete that never happened.
  const remove = () => confirm(t('departments.deleteConfirm'), () => {
    Promise.resolve(onDelete(department.id as Id)).then(result => {
      if (!result) { close(); return } // legacy void return (older callers/tests)
      if (result.ok) { close(); return }
      if (result.blocked) setBlockedCounts(result.blocked.counts)
    })
  }, { danger: true })

  // ARCHIVE-SUBENTITY-1: the shared mutation hook (§11 — mirrors LocationDetail/
  // ContactDetail's identical wiring). No confirm from the 409-race dialog's own
  // "Archiveer" escape (the user already explicitly chose that path); the
  // title-row button confirms first via doArchive below.
  const { archiving, archiveNow, doRestore } = useSubEntityArchive({
    customerId, id: department.id as Id, archiveFn: archiveDepartment, restoreFn: restoreDepartment, onDone: close,
    archiveFailedMessage: t('departments.detail.archiveFailed'), restoreFailedMessage: t('departments.detail.restoreFailed'),
  })
  const doArchive = () => confirm(t('departments.detail.confirmArchive', { name: department.name }), archiveNow)

  // A contact opened from this department's list brings its own full trail, so the
  // department steps aside — one title, one delete button, one way back.
  if (contactOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* `trail` carries only the ANCESTORS: ContactsPanel appends this department itself
            as its own list crumb (its scopeName IS department.name), so passing it here too
            printed "Dagbesteding › Dagbesteding" — measured live 28-07. */}
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name} customerId={customerId}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* One way back per level (see LocationDetail for why this replaced the old button). */}
      <DrillBreadcrumb trail={trail} current={department.name} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* JOB-STATUS-1: name + reference chip + status badge/picker — the shared
            component this file's near-verbatim copy was folded into (§0.3 split,
            2026-08-03, see SubEntityStatusTitleRow's own docblock). */}
        <SubEntityStatusTitleRow id={department.id as Id} name={department.name} referenceNumber={department.referenceNumber}
          statusId={department.statusId} statusLabel={department.statusLabel} statusColor={department.statusColor}
          statusOptions={statusOptions} onSave={onSave} />
        {/* §0.3 split: the pager/changelog/merge/archive/delete cluster is the shared
            SubEntityTitleActions (mirrors LocationDetail verbatim). Merge/archive are
            hidden without customers.update; merge also needs a second department to
            merge with (§3 — no fake affordance). */}
        <SubEntityTitleActions
          pager={pager}
          changelogEndpoint={customerId != null ? `/customers/${customerId}/departments/${department.id}/activity` : undefined}
          onMerge={canUpdate && departments.length > 1 ? () => setMerging(true) : undefined}
          mergeTitle={t('departments.detail.mergeDepartment')}
          onArchive={canUpdate && !department.archived ? doArchive : undefined}
          archiveTitle={t('departments.detail.archiveDepartment')}
          archiving={archiving}
          onDelete={remove}
          deleteDisabled={department.inUse}
          deleteTitle={department.inUse ? t('departments.deleteInUse') : t('common:delete')}
        />
      </div>

      {/* ARCHIVE-SUBENTITY-1: the in-body archived state, right under the title row. */}
      {department.archived && (
        <ArchivedBanner id={department.id} onRestore={doRestore}
          message={department.archivedAt ? t('departments.archivedBanner.since', { date: formatDate(department.archivedAt) }) : t('departments.archivedBanner.flag')}
          restoreLabel={t('departments.archivedBanner.restore')} />
      )}

      {/* Sub-tab strip — same shared bar as LocationDetail / the candidate Communicatie tab. */}
      <SubTabBar
        tabs={[
          { id: 'data',     label: t('departments.detail.subtabs.data') },
          { id: 'contacts', label: t('drawer.tabs.contacts') },
          // SCOPED-LIST-TAB-1: read-only lists scoped to this department (§3A shared tab).
          { id: 'vacancies', label: t('drawer.tabs.vacancies') },
          // SOLLICITATIES-SCOPE-1: reuses the applications page's own title key —
          // already carries full five-locale parity, verified in c0e0d900.
          { id: 'applications', label: t('applications:title') },
          // NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: reuse the existing top-level
          // drawer.tabs.notes/documents keys (already five-locale complete) —
          // right after Sollicitaties, per Danny's ask.
          { id: 'notes',     label: t('drawer.tabs.notes') },
          { id: 'documents', label: t('drawer.tabs.documents') },
          { id: 'matches',   label: t('drawer.tabs.matches') },
          // SCOPED-LIST-TAB-1: reuses the existing top-level drawer.tabs.opportunities
          // key (already five-locale complete) — right after Matches, per Danny's ask.
          { id: 'opportunities', label: t('drawer.tabs.opportunities') },
          // TAKEN-OP-AFDELING-1: TaskLinkResolver already knows 'department' → task_links.
          { id: 'tasks',     label: t('drawer.tabs.tasks') },
          ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra') }] : []),
          // EXTRACT-1: the shared Koppelingen sub-tab, last when it has content.
          // DD-FE-6 ("no empty tabs"): hidden when no connector app is enabled.
          ...(showKoppelingen ? [{ id: 'links', label: t('common:backofficeLinks.tabLabel') }] : []),
        ]}
        active={subTab}
        onChange={id => setSubTab(id as typeof subTab)}
      />

      {subTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* No repeated title (verified, unlike LocationDetail — see the file header
              comment): this sub-tab's own label already IS "Gegevens"/"Details" in
              three of five locales, identical to the group title, so a card title
              here would duplicate it AND collide with DepartmentsPanel.test.tsx's
              getByText on that sub-tab label. */}
          {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
              between rows, 11px labels. */}
          {/* Canon width (fieldRowCanon, 05-08): EditableFieldTable's own default now matches. */}
          <EditableFieldTable title="" fields={fields} value={values} onSave={save} />

          {/* Omschrijving AFTER the data blocks — Danny 02-08: every entity's prose block
              follows the customer Bedrijf-tab order (fields → text → Koios), so the
              earlier description-first placement was reversed on both location and here. */}
          {/* K5a (batch 5): second-screen icon, composite customerId:departmentId
              (departmentPopoutId — no standalone GET for one department). No
              `assistGenerate` yet — see CustomerDepartmentTextPopout's docblock
              for the written reason (GenerateEntity type widening is out of scope
              here). */}
          <EditableRichTextField label={t('departments.detail.description')} value={department.description ?? ''} onSave={saveDescription}
            popout={customerId != null ? { entity: 'customer', id: departmentPopoutId(customerId, department.id as Id), field: 'departmentText' } : undefined} />

          {/* Koios advice — pure FE completeness heuristics over this department's OWN
              fields, same slot LocationDetail/OverviewTab put it in (right after the
              text block, before any nested-entity sections). No API call. */}
          <KoiosAdviceBlock namespace="customers" insights={buildDepartmentAdviceInsights(department, t)} />
        </div>
      )}

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

      {/* The SAME panel the customer tab and a location render — one contact surface.
          `trail` carries only the ANCESTORS: the panel appends this department itself as its
          own list crumb (its scopeName IS department.name). */}
      {subTab === 'contacts' && (
        <ContactsPanel scope="department" scopeId={department.id as Id} scopeName={department.name} customerId={customerId}
          contacts={contacts} locations={locations} departments={departments} statuses={contactStatuses}
          trail={trail}
          openId={openContactId} onOpenChange={setOpenContactId}
          onAdd={onAddContact} onUpdate={onUpdateContact} onRemove={onRemoveContact} />
      )}
      {/* AFDELING-SAMENVOEGEN-1 — `others` is the customer-wide department list
          (already available as a prop), never a fresh search endpoint (see the
          modal's own doc). */}
      {merging && customerId != null && (
        <MergeSubEntityModal scope="department" customerId={customerId}
          current={{ id: department.id as Id, name: department.name }}
          others={departments.map(d => ({ id: d.id as Id, name: d.name, code: d.referenceNumber }))}
          onClose={() => setMerging(false)}
          onMerged={survivorId => { setMerging(false); onMerged?.(survivorId) }} />
      )}
      {dialog}
      {/* ARCHIVE-SUBENTITY-1: "kan niet verwijderen, wél archiveren" — the 409-race
          offers archiving as the way out; no second confirm (see archiveNow's doc). */}
      <InUseCountsDialog open={blockedCounts != null} counts={blockedCounts ?? {}} onClose={() => setBlockedCounts(null)}
        onArchive={() => { setBlockedCounts(null); void archiveNow() }} archiving={archiving} />
    </div>
  )
}

