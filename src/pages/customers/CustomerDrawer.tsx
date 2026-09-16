/**
 * CustomerDrawer — thin container for the customer detail. Wires data (header
 * config + tab list) onto the shared EntityDrawer/EntityHeader shell; all heavy
 * UI lives in one small component per tab under drawer/. Mirrors CandidateDrawer.
 *
 * The Planning tab is gated on the Planning module (same gate as the candidate
 * Planning tab); the Opportunities tab's flex-shift section is gated inside it.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, GitMerge } from 'lucide-react'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import DrawerGlyphButton from '@/components/drawer/DrawerGlyphButton'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import DrawerTitleRow from '@/components/drawer/DrawerTitleRow'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'
import CustomerHeaderActions from './drawer/CustomerHeaderActions'
import MergeCustomerModal from './MergeCustomerModal'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { initialsOf } from '@/lib/initials'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import { useCustomerDrawerActions } from './hooks/useCustomerDrawerActions'
import CustomerStatusReasonModal from './drawer/CustomerStatusReasonModal'
import ChangelogTab from './drawer/ChangelogTab'
// §0.3 split (K-SIZE-SPLIT-A): the whole tab-body switch, extracted so this
// thin container stays under the ~400-line trigger (§3).
import CustomerDrawerTabPanels from './drawer/CustomerDrawerTabPanels'
import { useCustomerLocations } from './hooks/useCustomerLocations'
import { useCustomerDepartments } from './hooks/useCustomerDepartments'
import { useCustomerContacts } from './hooks/useCustomerContacts'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { CustomerNoteCallbacks } from '@/types/customerNoteCallbacks'

const TABS = [
  { id: 'overview',      tKey: 'overview' },
  { id: 'locations',     tKey: 'locations' },
  { id: 'departments',   tKey: 'departments' },
  { id: 'contacts',      tKey: 'contacts' },
  { id: 'vacancies',     tKey: 'vacancies' },
  // MATCHES-TAB-1 (Danny): mirrors the candidate drawer's own Matches tab (§3A/§3B)
  // — read-only, GET /matches?customer_id={id}.
  { id: 'matches',       tKey: 'matches' },
  { id: 'opportunities', tKey: 'opportunities' },
  { id: 'planning',      tKey: 'planning' },
  // Danny 28-07: "Prijsafspraken hernoemen naar Financieel, met 2 subtabjes". The tab id
  // stays `priceAgreements` — it is the deep-link token the count-cells and the URL use.
  { id: 'priceAgreements', tKey: 'financial' },
  // TAKEN-OP-KLANT-1: unblocked 28-07 — GET /tasks?customer={id} really filters now
  // (TASKS-LINK-FILTER-1). Before that the filter was ignored and this tab would have
  // shown every task in the tenant, which is why it did not exist.
  { id: 'documents',     tKey: 'documents' },
  // Communicatie is ONE tab with a sub-tab strip (scope correction, Danny 28-07):
  // Notities · Tijdlijn · Vacaturezichtbaarheid live inside CustomerNotesTab.tsx.
  // Conversaties/Taken/Toestemmingen are NOT sub-tabs — no usable per-customer data
  // source exists yet (GET /tasks?customer={id} ignores the filter; consent lives
  // on the contact person, not the customer) and an empty sub-tab is a fake affordance.
  { id: 'communication', tKey: 'communication' },
  { id: 'extra',         tKey: 'extra' },
  // EXTRACT-1: the shared HelloFlex/Shiftmanager cards. Label comes from the shared
  // common:backofficeLinks.tabLabel key (not this file's own drawer.tabs.*), so all
  // six adopting entities read identically.
  { id: 'koppelingen',   tKey: 'backofficeLinks' },
  // X-38 (AFSPRAKEN-PLEK-1): every appointment linked to this customer through any of
  // its four customer-side keys — GET /appointments?customer_id=. Purely additive on the
  // frozen drill-down; sits before Tijdlijn/Statistieken (TIJDLIJN-OVERAL order).
  { id: 'appointments',  tKey: 'appointments' },
  // TIJDLIJN-OVERAL (27-08): second-to-last, reuses the same ChangelogTab content
  // the title-row popover renders — the popover itself stays untouched (§3A(d)).
  { id: 'timeline',      tKey: 'timeline' },
  // Statistieken sits LAST (Danny 28-07) — it is a read-only summary, not a working tab.
  { id: 'statistics',    tKey: 'statistics' },
]

interface DrawerUser { id: Id; name: string; avatar_color?: string }

interface CustomerDrawerProps extends CustomerNoteCallbacks {
  customer: Customer | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  // STATUS-OVERRIDE-REVERT-1: the caller may resolve true/false so a local
  // override (useCustomerDrawerActions' status/phase/owner) can clear on a
  // rejected PATCH.
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void | Promise<boolean>
  users?: DrawerUser[]
  statuses?: LookupOption[]
  // SUB-STATUS-1: the three sub-entity status lookups (one API call, lifted from
  // CustomersPage's useCustomerLookups so the drawer doesn't re-fetch them).
  locationStatuses?: LookupOption[]
  departmentStatuses?: LookupOption[]
  contactStatuses?: LookupOption[]
  // Deep-link: open on this tab (table count-cell → locations/departments/contacts/
  // vacancies), mirrors the candidate drawer's initialTab.
  initialTab?: string
  // TRASH-OVERAL-2: restore-to-active (page passes this only with customers.update)
  // + the shared trash-section wiring (mark/unmark, see TrashLifecycleSection).
  onRestore?: (id: Id | undefined) => void
  trash?: TrashSectionConfig
}

// Thin container: the customer entity drawer. Wires header state (status/phase/owner/
// tags), the sub-entity CRUD hooks (locations/departments/contacts) and tab rendering;
// mutations flow through the optimistic onUpdate prop, never a local source of truth.
export default function CustomerDrawer({
  customer: c, onClose, expanded, onToggleExpand, onUpdate, onAddNote, onEditNote, onDeleteNote,
  onFetchPreviousVersion, onRestorePreviousNote,
  users = [], statuses = [], locationStatuses = [], departmentStatuses = [], contactStatuses = [], initialTab,
  onRestore, trash,
}: CustomerDrawerProps) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  // EXTRACT-1: the Koppelingen tab's "Koppelen" buttons gate on customers.update
  // (BackofficeEntityRegistry) — the UI check; the backend re-checks regardless (§7).
  const hasPermission = auth?.hasPermission ?? (() => false)
  const canLinkBackoffice = hasPermission('customers.update')
  // DELETE-ICON-1 (Danny): the drawer's soft-delete trash icon, same permission the
  // page's own bulk-archive button already gates on.
  const canDelete = hasPermission('customers.delete')
  // KLANT-SAMENVOEGEN-1: the merge icon gates on the SAME permission the route itself
  // requires (customers.update — a merge is update-class, reversible: the absorbed
  // record is soft-deleted, never hard) — the backend re-checks regardless (§7).
  const canMerge = hasPermission('customers.update')
  const { formatDate, formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined customer custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer')
  // Fallback note-author avatar = the signed-in user (mirrors the candidate tab);
  // note-type lookups now live inside CustomerNotesTab itself.
  const authorInitials = initialsOf(auth?.user?.name ?? '')

  // Locations/departments/contacts CRUD — one source of truth shared by the
  // Locaties/Afdelingen/Contactpersonen tabs AND the location detail's nested
  // sections (§3A: reuse, never fork). Lives here (always mounted while a
  // customer is selected) rather than per-tab, so switching tabs never refetches.
  const locationsApi   = useCustomerLocations(c?.id)
  const departmentsApi = useCustomerDepartments(c?.id)
  const contactsApi    = useCustomerContacts(c?.id)

  // Sub-entity id → name lookups for the changelog chip (K-ACTLOG-SUBJECT-NAME-1):
  // these lists are already loaded here for the CRUD tabs, so the rolled-up
  // changelog chip can name the exact location/department/contact, not only its type.
  const locationNames = useMemo(
    () => Object.fromEntries(locationsApi.locations.filter(l => l.id !== undefined).map(l => [String(l.id), l.name])),
    [locationsApi.locations],
  )
  const departmentNames = useMemo(
    () => Object.fromEntries(departmentsApi.departments.filter(d => d.id !== undefined).map(d => [String(d.id), d.name])),
    [departmentsApi.departments],
  )
  const contactNames = useMemo(
    () => Object.fromEntries(contactsApi.contacts.filter(ct => ct.id !== undefined).map(ct => [String(ct.id), ct.name])),
    [contactsApi.contacts],
  )

  // Header state, convert-phase, delete and merge wiring — extracted to its own
  // hook (see useCustomerDrawerActions.ts); called unconditionally (rules of
  // hooks), same as the useState calls it replaces, before the null check below.
  const {
    currentStatus, currentTags, changeStatus,
    blacklistModal, setBlacklistModal, confirmBlacklist, blacklistReasons, blacklistReasonsLoaded,
    currentPhase, phaseInfo, showStatus,
    targetPhase, isEntryPhase, doConvertPhase,
    ownerOptions, ownerValue, onOwnerChange,
    headerEditing, headerName, setHeaderName, startHeaderEdit, saveHeader, setHeaderEditing,
    requestDelete, deleteDialog,
    showMerge, setShowMerge,
    setTags,
  } = useCustomerDrawerActions({ c, onUpdate, onClose, users, statuses })

  // Inline-edit-cancel layer: the header name input cancels edit mode on Escape (FROZEN family — Escape wiring only, TRIAGE-3.3).
  useEscapeLayer(headerEditing, () => setHeaderEditing(false))

  // Keep the list/KPI counts in sync with the live sub-entity counts (a pure local
  // state bump — 'locationsCount' etc. aren't in useCustomerRecord's FIELD_MAP, so
  // this never fires a stray PATCH /customers/{id}).
  useEffect(() => {
    if (c) onUpdate?.(c.id, { locationsCount: locationsApi.locations.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsApi.locations.length])
  // Mirror the live department count into the list/KPI cache, same reasoning as the locations effect above.
  useEffect(() => {
    if (c) onUpdate?.(c.id, { departmentsCount: departmentsApi.departments.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentsApi.departments.length])
  // Mirror the live contact count into the list/KPI cache, same reasoning as the locations effect above.
  useEffect(() => {
    if (c) onUpdate?.(c.id, { contactsCount: contactsApi.contacts.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsApi.contacts.length])

  if (!c) return null

  // Planning tab only for tenants with the Planning module (same gate as sidebar);
  // Extra tab only when ≥1 active custom field is defined (§3A(f)).
  const tabs = TABS.filter(tab => (tab.id !== 'planning' || hasModule('plan')) && (tab.id !== 'extra' || customFieldDefs.length > 0))

  // Plain {id,name} location list — the shared shape the sub-entity pickers need.
  const locationOptions = locationsApi.locations.map(l => ({ id: l.id as Id, name: l.name }))

  // §0.3 split (K-SIZE-SPLIT-A): the tab-body dispatch itself lives in
  // CustomerDrawerTabPanels now — this stays a thin wrapper around it.
  const renderTab = (id: string, setActiveTab?: (id: string) => void): ReactNode => (
    <CustomerDrawerTabPanels
      id={id} c={c} setActiveTab={setActiveTab}
      locationsApi={locationsApi} departmentsApi={departmentsApi} contactsApi={contactsApi}
      statuses={statuses} locationOptions={locationOptions}
      locationStatuses={locationStatuses} departmentStatuses={departmentStatuses} contactStatuses={contactStatuses}
      canLinkBackoffice={canLinkBackoffice} authorInitials={authorInitials}
      locationNames={locationNames} departmentNames={departmentNames} contactNames={contactNames}
      onUpdate={onUpdate} onAddNote={onAddNote} onEditNote={onEditNote} onDeleteNote={onDeleteNote}
      onFetchPreviousVersion={onFetchPreviousVersion} onRestorePreviousNote={onRestorePreviousNote}
    />
  )

  // Header title: an inline name input while editing, else name + subtitle.
  const renderTitle = () => headerEditing ? (
    <input value={headerName} autoFocus placeholder={t('cols.name')}
      onChange={e => setHeaderName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveHeader() }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 14, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
  ) : (
    // DRY round 10, DRAWERSHELLS: title/reference-chip/detached-badge row shared via
    // DrawerTitleRow with CandidateHeaderBits and VacancyDrawer (clone [10]) — mirrors
    // EntityHeader's own canonical title recipe (PageTitle + 700 override); this
    // customer's detached count spans ALL its vacancies, not just this drawer.
    <DrawerTitleRow title={c.name} titleAs="div" referenceNumber={c.referenceNumber} detachedCount={c.detachedCount}
      subtitle={[c.city, c.industry].filter(Boolean).join(' · ') || '—'} />
  )

  // Header actions: convert (entry phase) plus the edit/save/cancel toggles — split
  // into its own component (mirrors the candidate's CandidateHeaderActions, §3A).
  const headerActions = (
    <CustomerHeaderActions
      isEntryPhase={isEntryPhase} targetPhase={targetPhase} onConvert={doConvertPhase}
      headerEditing={headerEditing} onStartEdit={startHeaderEdit} onSaveEdit={saveHeader} onCancelEdit={() => setHeaderEditing(false)}
    />
  )

  return (
    <>
    <EntityDrawer
      entity={c}
      initialTab={initialTab}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<Caption>{t('drawer.createdAt', { date: c.created ? formatDateTime(c.created) : '—' })}</Caption>}
      tabs={tabs.map(tab => ({
        // The Koppelingen tab reads the SHARED common:backofficeLinks.tabLabel key
        // (§3A/§11) — never this file's own drawer.tabs.* — so all six adopting
        // entities show the exact same label.
        id: tab.id, label: tab.id === 'koppelingen' ? t('common:backofficeLinks.tabLabel') : t(`drawer.tabs.${tab.tKey}`),
        render: (setActiveTab?: (id: string) => void) => renderTab(tab.id, setActiveTab),
      }))}
      header={() => (
        // TITEL-CHIP-1 (Danny 19-08: "net zoals bij kandidaat"): the phase chip IS
        // the title; static word only while no phase is known.
        // No fake affordance (§3): the customer entity has no logo upload route
        // (unlike the location's own, see LocationLogoAvatar), so `avatar` omits
        // onPhotoChange/photoLabels — PhotoAvatar then renders its own read-only
        // branch instead of wiring the menu to unpersisted state.
        <EntityHeader
          label={currentPhase ? <SoftChip label={phaseInfo.label} color={phaseInfo.color} round /> : t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: c.logo, soft: true }}
          renderTitle={renderTitle}
          titleActions={<>
            {/* Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
                cramped 360px dropdown with no focus trap; now the same 900px centred
                panel as the candidate drawer. */}
            <ChangelogPopover><ChangelogTab customerId={c.id} locationNames={locationNames} departmentNames={departmentNames} contactNames={contactNames} /></ChangelogPopover>
            {/* KLANT-SAMENVOEGEN-1: merge a duplicate into this record — same slot/style
                as the candidate drawer's own merge icon (klok · samenvoegen · prullenbak),
                permission-gated, hidden once already archived. */}
            {canMerge && !c.archived && (
              <DrawerGlyphButton onClick={() => setShowMerge(true)} title={t('merge.title')} tone="muted" opacity={0.8}>
                <GitMerge size={14} />
              </DrawerGlyphButton>
            )}
            {/* DELETE-ICON-1: soft-delete (§3B), same position/style as the candidate
                drawer's own trash icon — permission-gated, hidden once already archived. */}
            {canDelete && !c.archived && (
              <DrawerGlyphButton onClick={requestDelete} title={t('drawer.delete')} tone="danger" opacity={0.7}>
                <Trash2 size={14} />
              </DrawerGlyphButton>
            )}
          </>}
          actions={headerActions}
          meta={[
            // Danny 02-08: no Status picker at all while in the entry phase — a
            // Prospect has no deployability status yet (mirrors the candidate
            // drawer's showStatus gate; see CustomerStatusChip for the read-only
            // display-side counterpart of this same rule). KLANT-FASE-CONVERT-1:
            // Fase moved OUT of this picker list into the read-only header badge
            // (mirrors the candidate header, §3A(c)) — see renderTitle above.
            ...(showStatus ? [{ key: 'status', label: t('drawer.status'), value: currentStatus, width: 160,
              options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 170 }] : []),
            { key: 'owner', label: t('drawer.owner'), value: ownerValue, width: 200,
              options: ownerOptions, onChange: onOwnerChange, menuWidth: 200 },
          ]}
          tags={{ items: currentTags, onAdd: tag => { const next = [...currentTags, tag]; setTags(next); onUpdate?.(c.id, { tags: next }) },
                  onRemove: tag => { const next = currentTags.filter(x => x !== tag); setTags(next); onUpdate?.(c.id, { tags: next }) },
                  addLabel: t('drawer.addTag') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* TRASH-OVERAL-2: archived state + restore via the ONE shared ArchivedBanner
              (§3A — the customer record itself never had a restore button; the
              sub-entity banners reuse the same generic locations.archivedBanner keys).
              Hidden once the record sits in the trash — the trash banner takes over. */}
          {c.archived && c.lifecycle !== 'pending_erase' && (
            <ArchivedBanner id={c.id} onRestore={onRestore}
              message={c.archivedAt ? t('locations.archivedBanner.since', { date: formatDate(c.archivedAt) }) : t('locations.archivedBanner.flag')}
              restoreLabel={t('locations.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: the shared mark/unmark surface (permission-gated in `trash`). */}
          {trash && (
            <TrashLifecycleSection entityPath="customers" id={c.id} entityLabel={c.name}
              lifecycle={c.lifecycle} pendingEraseAt={c.pendingEraseAt} {...trash} />
          )}
        </EntityHeader>
      )}
    />
    {/* DELETE-ICON-1: the shared confirm dialog, mounted once per drawer. */}
    {deleteDialog}
    {/* KLANT-BLACKLIST-PROMPT-1: the blacklist status-reason prompt, mounted only
        while open (mirrors CandidateStatusModals' fresh-mount-per-open pattern). */}
    {blacklistModal && (
      <CustomerStatusReasonModal state={blacklistModal} reasons={blacklistReasons} reasonsLoaded={blacklistReasonsLoaded}
        onChangeReason={reason => setBlacklistModal(m => m && ({ ...m, reason }))}
        onCancel={() => setBlacklistModal(null)}
        onConfirm={confirmBlacklist} />
    )}
    {/* KLANT-SAMENVOEGEN-1: the open record is always the SURVIVOR (see the modal's own
        docblock for the measured route direction), so its id never changes here — no
        reselect needed, only a refresh of the sub-entity data that may have just moved
        in from the absorbed duplicate. The list/stats query cache is invalidated inside
        the modal itself. Known gap: the survivor's OWN top-level fields backfilled from
        the duplicate (email/phone/tags/custom fields, …) only show after the drawer is
        reopened — CustomersPage's detail refetch is outside this file's scope. */}
    {showMerge && (
      <MergeCustomerModal
        current={{ id: c.id as Id, name: c.name, code: c.referenceNumber, city: c.city }}
        onClose={() => setShowMerge(false)}
        onMerged={() => {
          setShowMerge(false)
          locationsApi.reload()
          departmentsApi.reload()
          contactsApi.reload()
        }}
      />
    )}
    </>
  )
}
