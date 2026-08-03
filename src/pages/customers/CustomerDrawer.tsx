/**
 * CustomerDrawer — thin container for the customer detail. Wires data (header
 * config + tab list) onto the shared EntityDrawer/EntityHeader shell; all heavy
 * UI lives in one small component per tab under drawer/. Mirrors CandidateDrawer.
 *
 * The Planning tab is gated on the Planning module (same gate as the candidate
 * Planning tab); the Opportunities tab's flex-shift section is gated inside it.
 */
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, GitMerge } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomerHeaderActions from './drawer/CustomerHeaderActions'
import MergeCustomerModal from './MergeCustomerModal'
import PdokCard from '@/components/drawer/PdokCard'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings } from '@/lib/settings/useAllSettings'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { initialsOf } from '@/lib/initials'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
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
  // Statistieken sits LAST (Danny 28-07) — it is a read-only summary, not a working tab.
  { id: 'statistics',    tKey: 'statistics' },
]

interface DrawerUser { id: Id; name: string; avatar_color?: string }
type NotePayload = { type: string; title: string; body: string }

interface CustomerDrawerProps {
  customer: Customer | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void
  onAddNote?: (id: Id | undefined, payload: NotePayload) => void
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
}

export default function CustomerDrawer({
  customer: c, onClose, expanded, onToggleExpand, onUpdate, onAddNote,
  users = [], statuses = [], locationStatuses = [], departmentStatuses = [], contactStatuses = [], initialTab,
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
  const { formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined customer custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('customer')
  // KLANT-FASE-1: the lifecycle-phase lookup behind the header badge (session-cached).
  const { phases, phaseMeta } = useCustomerPhases()
  // CUSTOMER-DEFAULT-STATUS-1: the tenant settings blob, read the same way
  // useCandidateStatus.ts reads its own (mirrors DEFAULT-STATUS-1) — used by
  // doConvertPhase below to apply the configured default status on convert.
  const allSettings = useAllSettings()
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

  // Header overrides — reset when a different customer is shown (during render).
  const [status, setStatus] = useState<string | null>(null)
  // KLANT-FASE-1: local override for the phase picker, same pattern as `status`.
  const [phase,  setPhase]  = useState<string | null>(null)
  const [owner,  setOwner]  = useState<DrawerUser | null>(null)
  const [tags,   setTags]   = useState<string[] | null>(null)
  // Header name edit + logo upload — independent from the Overview-tab fields (mirrors the candidate).
  const [headerEditing, setHeaderEditing] = useState(false)
  const [headerName,    setHeaderName]    = useState('')
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null)
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) { setPrevId(c?.id); setStatus(null); setPhase(null); setOwner(null); setTags(null); setHeaderEditing(false); setLogoUrl(null) }

  // Keep the list/KPI counts in sync with the live sub-entity counts (a pure local
  // state bump — 'locationsCount' etc. aren't in useCustomerRecord's FIELD_MAP, so
  // this never fires a stray PATCH /customers/{id}).
  useEffect(() => {
    if (c) onUpdate?.(c.id, { locationsCount: locationsApi.locations.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsApi.locations.length])
  useEffect(() => {
    if (c) onUpdate?.(c.id, { departmentsCount: departmentsApi.departments.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentsApi.departments.length])
  useEffect(() => {
    if (c) onUpdate?.(c.id, { contactsCount: contactsApi.contacts.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsApi.contacts.length])

  // DELETE-ICON-1: the house confirm dialog (§0 restschuld) — same shared hook the
  // candidate drawer's own trash icon and OpportunitiesTab's delete already use.
  const { confirm, dialog: deleteDialog } = useConfirm()
  // KLANT-SAMENVOEGEN-1: the merge overlay is its own two-step modal (mirrors the
  // candidate's MergeCandidateModal), not the house confirm dialog above.
  const [showMerge, setShowMerge] = useState(false)

  if (!c) return null

  // Enter/save the header name edit; save flows through the optimistic onUpdate.
  const startHeaderEdit = () => { setHeaderName(c.name ?? ''); setHeaderEditing(true) }
  const saveHeader = () => { if (headerName.trim()) onUpdate?.(c.id, { name: headerName.trim() }); setHeaderEditing(false) }

  // DELETE-ICON-1: soft-delete this customer (DELETE /customers/{id}, the entity-wide
  // per-record convention, §10) — the backend re-checks live links (§3B) and answers
  // 409 when any still hang on it, mapped to i18n rather than shown as raw server text.
  // Flags `archived` locally (never a stray PATCH — 'archived' isn't in
  // useCustomerRecord's FIELD_MAP, mirrors the locationsCount bumps above) so the
  // page's existing archived-view filter hides the row immediately, then closes.
  const requestDelete = () => {
    confirm(t('drawer.deleteConfirm', { name: c.name }), () => {
      api.delete(`/customers/${c.id}`).then(() => {
        notifySuccess(t('drawer.deletedNamed', { name: c.name }))
        onUpdate?.(c.id, { archived: true })
        onClose()
      }).catch(err => {
        const status = (err as { response?: { status?: number } })?.response?.status
        notifyError(t(status === 409 ? 'drawer.deleteBlocked' : 'drawer.deleteFailed', { name: c.name }))
      })
    }, { danger: true })
  }

  // Planning tab only for tenants with the Planning module (same gate as sidebar);
  // Extra tab only when ≥1 active custom field is defined (§3A(f)).
  const tabs = TABS.filter(tab => (tab.id !== 'planning' || hasModule('plan')) && (tab.id !== 'extra' || customFieldDefs.length > 0))

  const currentStatus = status ?? c.status
  const currentTags   = tags ?? (c.tags as string[]) ?? []
  const changeStatus  = (v: string) => { setStatus(v); onUpdate?.(c.id, { status: v }) }
  // KLANT-FASE-1: phase is its own axis next to status — shown as a read-only badge
  // (KLANT-FASE-CONVERT-1 below), backed by the `phase` column (PATCH /customers/{id}).
  const currentPhase  = phase ?? c.phase
  const phaseInfo     = phaseMeta(currentPhase)
  // Danny 02-08: "Prospect heeft geen status" — mirrors the candidate drawer's
  // showStatus gate (useCandidateStatus.ts): a customer still in the ENTRY phase
  // isn't deployable yet, so the Status picker doesn't show at all. Resolved via
  // the `is_default` FLAG (never an array position — see CustomerStatusChip for
  // why that matters), so reordering the phase lookup in Settings never misfires.
  const entryPhaseValue = phases.find(p => p.isDefault)?.value
  const showStatus = !!currentPhase && currentPhase !== entryPhaseValue
  // KLANT-FASE-CONVERT-1 (Danny 02-08): "convert prospect to customer" mirrors the
  // candidate's Lead → Candidate convert (§3A(c)) — a read-only phase badge next to
  // the name (see renderTitle below) plus a one-click convert button in the header,
  // no picker, no confirm. Target = the phase flagged `isCustomer`, NEVER an array
  // position: the customer phase lookup carries real behaviour flags (§3B), unlike
  // the candidate hook's index-based `phases[phaseIdx + 1]`. No isCustomer option
  // configured on the tenant's lookup → render no convert button at all (a convert
  // into an unknown phase is worse than none).
  const targetPhase = phases.find(p => p.isCustomer)
  const isEntryPhase = !!entryPhaseValue && currentPhase === entryPhaseValue
  // CUSTOMER-DEFAULT-STATUS-1 (Danny 2026-08-03): mirrors the candidate convert
  // (DEFAULT-STATUS-1, useCandidateStatus.ts) — a Prospect converting to Klant
  // gets the tenant's configured default status in the SAME patch as the phase,
  // but ONLY when the customer has no status yet. Unlike the candidate axis, an
  // absent setting (or one pointing at a since-deleted status) leaves the status
  // untouched — 'none' is the honest default here (today's behaviour), never a
  // guessed real value; the customer status lookup also carries none of the
  // candidate's requires_match/is_blacklist flags, so no extra guard is needed.
  const doConvertPhase = () => {
    if (!targetPhase || !c) return
    const patch: Record<string, unknown> = { phase: targetPhase.value }
    const defRaw = (allSettings as Record<string, unknown> | null)?.['customer_default_status_on_convert']
    const def = typeof defRaw === 'string' ? defRaw : 'none'
    const wantsDefault = !(status ?? c.status) && def !== 'none' && statuses.some(s => s.value === def)
    if (wantsDefault) { setStatus(def); patch.status = def }
    setPhase(targetPhase.value)
    onUpdate?.(c.id, patch)
  }

  // Owner (account manager) picker — a fallback entry ONLY when the current
  // owner is not in the selectable `users` list (always prepending it duplicated
  // the account manager in the dropdown — Danny 2026-07-14, same bug fixed on
  // the candidate drawer, commit 9147ea6; mirrored here).
  const currentOwnerId = owner?.id ?? c.ownerId
  const ownerInUsers = currentOwnerId != null && users.some(u => String(u.id) === String(currentOwnerId))
  const ownerOptions = [
    ...(ownerInUsers || !c.owner ? [] : [{ value: '__current', label: owner?.name ?? c.owner ?? '—', initials: owner ? initialsOf(owner.name) : c.ownerInitials }]),
    ...users.map(u => ({ value: String(u.id), label: u.name, initials: initialsOf(u.name) })),
  ]
  const ownerValue = ownerInUsers ? String(currentOwnerId) : '__current'
  const onOwnerChange = (id: string) => {
    if (id === '__current') return
    const u = users.find(x => String(x.id) === id)
    if (u) { setOwner({ ...u }); onUpdate?.(c.id, { ownerId: u.id, owner: u.name, ownerInitials: initialsOf(u.name), ownerColor: u.avatar_color ?? null }) }
  }

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
              there is no city yet — the customer's own address is city-only here. */}
          <PdokCard endpoint={`/customers/${c.id}/geocode`} permission="customers.update" disabled={!c.city} />
        </BackofficeLinksTab>
      )
      default: return null
    }
  }

  // Header title: an inline name input while editing, else name + subtitle.
  const renderTitle = () => headerEditing ? (
    <input value={headerName} autoFocus placeholder={t('cols.name')}
      onChange={e => setHeaderName(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveHeader(); if (e.key === 'Escape') setHeaderEditing(false) }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 14, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
  ) : (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
        {/* KLANT-FASE-CONVERT-1: Fase = colour-coded read-only badge next to the name
            (mirrors the candidate's CandidateTitle, §3A(c)) — convert lives in the
            header actions below, never a picker. */}
        {currentPhase && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
            background: phaseInfo.color + '1A', color: phaseInfo.color, border: `1px solid ${phaseInfo.color}55` }}>{phaseInfo.label}</span>
        )}
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={c.referenceNumber} />
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
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: c.created ? formatDateTime(c.created) : '—' })}</span>}
      tabs={tabs.map(tab => ({
        // The Koppelingen tab reads the SHARED common:backofficeLinks.tabLabel key
        // (§3A/§11) — never this file's own drawer.tabs.* — so all six adopting
        // entities show the exact same label.
        id: tab.id, label: tab.id === 'koppelingen' ? t('common:backofficeLinks.tabLabel') : t(`drawer.tabs.${tab.tKey}`),
        render: (setActiveTab?: (id: string) => void) => renderTab(tab.id, setActiveTab),
      }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: logoUrl ?? c.logo, soft: true }}
          onPhotoChange={setLogoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)', opacity: 0.8 }}>
                <GitMerge size={14} />
              </button>
            )}
            {/* DELETE-ICON-1: soft-delete (§3B), same position/style as the candidate
                drawer's own trash icon — permission-gated, hidden once already archived. */}
            {canDelete && !c.archived && (
              <button onClick={requestDelete}
                title={t('drawer.delete')} aria-label={t('drawer.delete')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger)', opacity: 0.7 }}>
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
        />
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
