/**
 * CustomerDrawer — thin container for the customer detail. Wires data (header
 * config + tab list) onto the shared EntityDrawer/EntityHeader shell; all heavy
 * UI lives in one small component per tab under drawer/. Mirrors CandidateDrawer.
 *
 * The Planning tab is gated on the Planning module (same gate as the candidate
 * Planning tab); the Opportunities tab's flex-shift section is gated inside it.
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, GitMerge } from 'lucide-react'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import DetachedCountBadge from '@/components/ui/DetachedCountBadge'
import SoftChip from '@/components/ui/SoftChip'
import { Caption, PageTitle } from '@/components/ui/typography'
import CustomerHeaderActions from './drawer/CustomerHeaderActions'
import MergeCustomerModal from './MergeCustomerModal'
import PdokCard from '@/components/drawer/PdokCard'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { initialsOf } from '@/lib/initials'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import { useCustomerDrawerActions } from './hooks/useCustomerDrawerActions'
import ChangelogTab from './drawer/ChangelogTab'
import OverviewTab from './drawer/OverviewTab'
import LocationsTab from './drawer/LocationsTab'
import DepartmentsTab from './drawer/DepartmentsTab'
import ContactsTab from './drawer/ContactsTab'
import VacanciesTab from './drawer/VacanciesTab'
import MatchesTab from './drawer/MatchesTab'
import OpportunitiesTab from './drawer/OpportunitiesTab'
import PlanningTab from './drawer/PlanningTab'
import StatisticsTab from './drawer/StatisticsTab'
import DocumentsTab from './drawer/DocumentsTab'
import PriceAgreementsTab from './drawer/PriceAgreementsTab'
import CustomerNotesTab from './drawer/CustomerNotesTab'
import { useCustomerLocations } from './hooks/useCustomerLocations'
import { useCustomerDepartments } from './hooks/useCustomerDepartments'
import { useCustomerContacts } from './hooks/useCustomerContacts'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

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
  // TIJDLIJN-OVERAL (27-08): second-to-last, reuses the same ChangelogTab content
  // the title-row popover renders — the popover itself stays untouched (§3A(d)).
  { id: 'timeline',      tKey: 'timeline' },
  // Statistieken sits LAST (Danny 28-07) — it is a read-only summary, not a working tab.
  { id: 'statistics',    tKey: 'statistics' },
]

interface DrawerUser { id: Id; name: string; avatar_color?: string }
// NOTE-TAAL-1: optional per-note language, forwarded unchanged to useCustomerRecord's addNote.
type NotePayload = { type: string; title: string; body: string; language?: string }

interface CustomerDrawerProps {
  customer: Customer | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void
  onAddNote?: (id: Id | undefined, payload: NotePayload) => void
  // K15NOTES: edit/delete a single existing note — mirrors onAddNote's (id, payload)
  // shape, plus the note's own id so the host can resolve which note changed.
  onEditNote?: (id: Id | undefined, noteId: Id | undefined, payload: NotePayload) => void
  onDeleteNote?: (id: Id | undefined, noteId: Id | undefined) => void
  // NOTE-UNDO-FE-1 (K-172): peek + execute the one-slot undo — mirrors onEditNote's
  // (id, noteId) shape, resolved by the host (useCustomerRecord).
  onFetchPreviousVersion?: (id: Id | undefined, noteId: Id | undefined) => Promise<{ previous_body: string | null; previous_saved_at: string | null } | null>
  onRestorePreviousNote?: (id: Id | undefined, noteId: Id | undefined) => Promise<boolean>
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

  // Header state, convert-phase, delete and merge wiring — extracted to its own
  // hook (see useCustomerDrawerActions.ts); called unconditionally (rules of
  // hooks), same as the useState calls it replaces, before the null check below.
  const {
    currentStatus, currentTags, changeStatus,
    currentPhase, phaseInfo, showStatus,
    targetPhase, isEntryPhase, doConvertPhase,
    ownerOptions, ownerValue, onOwnerChange,
    headerEditing, headerName, setHeaderName, startHeaderEdit, saveHeader, setHeaderEditing,
    logoUrl, setLogoUrl,
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

  const renderTab = (id: string, setActiveTab?: (id: string) => void): ReactNode => {
    switch (id) {
      case 'overview':      return <OverviewTab c={c} onSave={v => onUpdate?.(c.id, v)} />
      case 'locations':     return (
        <LocationsTab
          customerId={c.id} customerName={c.name} locations={locationsApi.locations} departments={departmentsApi.departments} contacts={contactsApi.contacts}
          statuses={locationStatuses} departmentStatuses={departmentStatuses} contactStatuses={contactStatuses}
          canLinkBackoffice={canLinkBackoffice}
          onAddLocation={locationsApi.add}
          onSaveLocation={locationsApi.update} onDeleteLocation={locationsApi.remove}
          onAddDepartment={(payload, locName) => departmentsApi.add(payload, locName)}
          onUpdateDepartment={(id, payload, locName) => departmentsApi.update(id, payload, locName)}
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
      case 'timeline':      return <ChangelogTab customerId={c.id} />
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

  // Header title: an inline name input while editing, else name + subtitle.
  const renderTitle = () => headerEditing ? (
    <input value={headerName} autoFocus placeholder={t('cols.name')}
      onChange={e => setHeaderName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveHeader() }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 14, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
  ) : (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Mirrors EntityHeader's own canonical title recipe (PageTitle + 700 override). */}
        <PageTitle as="div" style={{ fontWeight: 700 }}>{c.name}</PageTitle>
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={c.referenceNumber} />
        {/* ONTKOPPEL-TELLER-1: whole-history CURRENTLY-detached count across ALL this
            customer's vacancies, warning-only (hidden at 0). */}
        <DetachedCountBadge count={c.detachedCount} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[c.city, c.industry].filter(Boolean).join(' · ') || '—'}</div>
    </>
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
        <EntityHeader
          // TITEL-CHIP-1 (Danny 19-08: "net zoals bij kandidaat"): the phase chip IS
          // the title; static word only while no phase is known.
          label={currentPhase ? <SoftChip label={phaseInfo.label} color={phaseInfo.color} round /> : t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: logoUrl ?? c.logo, soft: true }}
          onPhotoChange={setLogoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove'), change: t('drawer.photoChange') }}
          renderTitle={renderTitle}
          titleActions={<>
            {/* Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
                cramped 360px dropdown with no focus trap; now the same 900px centred
                panel as the candidate drawer. */}
            <ChangelogPopover><ChangelogTab customerId={c.id} /></ChangelogPopover>
            {/* KLANT-SAMENVOEGEN-1: merge a duplicate into this record — same slot/style
                as the candidate drawer's own merge icon (klok · samenvoegen · prullenbak),
                permission-gated, hidden once already archived. */}
            {canMerge && !c.archived && (
              <button onClick={() => setShowMerge(true)}
                title={t('merge.title')} aria-label={t('merge.title')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): deliberate bare 14px icon; Button iconOnly’s 28px chrome would change the frozen look
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)', opacity: 0.8 }}>
                <GitMerge size={14} />
              </button>
            )}
            {/* DELETE-ICON-1: soft-delete (§3B), same position/style as the candidate
                drawer's own trash icon — permission-gated, hidden once already archived. */}
            {canDelete && !c.archived && (
              <button onClick={requestDelete}
                title={t('drawer.delete')} aria-label={t('drawer.delete')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- frozen calm-header glyph control (Danny 08-08): deliberate bare 14px icon; Button iconOnly’s 28px chrome would change the frozen look
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger-text)', opacity: 0.7 }}>
                <Trash2 size={14} />
              </button>
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
