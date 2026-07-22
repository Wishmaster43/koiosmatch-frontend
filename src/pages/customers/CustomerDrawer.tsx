/**
 * CustomerDrawer — thin container for the customer detail. Wires data (header
 * config + tab list) onto the shared EntityDrawer/EntityHeader shell; all heavy
 * UI lives in one small component per tab under drawer/. Mirrors CandidateDrawer.
 *
 * The Planning tab is gated on the Planning module (same gate as the candidate
 * Planning tab); the Opportunities tab's flex-shift section is gated inside it.
 */
import { useState, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Edit2, Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import GeocodeButton from '@/components/ui/GeocodeButton'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import { initialsOf } from '@/lib/initials'
import CustomerChangelog from './drawer/CustomerChangelog'
import OverviewTab from './drawer/OverviewTab'
import LocationsTab from './drawer/LocationsTab'
import DepartmentsTab from './drawer/DepartmentsTab'
import ContactsTab from './drawer/ContactsTab'
import VacanciesTab from './drawer/VacanciesTab'
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
  { id: 'opportunities', tKey: 'opportunities' },
  { id: 'planning',      tKey: 'planning' },
  { id: 'statistics',    tKey: 'statistics' },
  { id: 'priceAgreements', tKey: 'priceAgreements' },
  { id: 'documents',     tKey: 'documents' },
  { id: 'notes',         tKey: 'notes' },
  { id: 'extra',         tKey: 'extra' },
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
  const { formatDateTime } = useDateFormat()
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

  // Header overrides — reset when a different customer is shown (during render).
  const [status, setStatus] = useState<string | null>(null)
  const [owner,  setOwner]  = useState<DrawerUser | null>(null)
  const [tags,   setTags]   = useState<string[] | null>(null)
  // Header name edit + logo upload — independent from the Overview-tab fields (mirrors the candidate).
  const [headerEditing, setHeaderEditing] = useState(false)
  const [headerName,    setHeaderName]    = useState('')
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null)
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) { setPrevId(c?.id); setStatus(null); setOwner(null); setTags(null); setHeaderEditing(false); setLogoUrl(null) }

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

  if (!c) return null

  // Enter/save the header name edit; save flows through the optimistic onUpdate.
  const startHeaderEdit = () => { setHeaderName(c.name ?? ''); setHeaderEditing(true) }
  const saveHeader = () => { if (headerName.trim()) onUpdate?.(c.id, { name: headerName.trim() }); setHeaderEditing(false) }

  // Planning tab only for tenants with the Planning module (same gate as sidebar);
  // Extra tab only when ≥1 active custom field is defined (§3A(f)).
  const tabs = TABS.filter(tab => (tab.id !== 'planning' || hasModule('plan')) && (tab.id !== 'extra' || customFieldDefs.length > 0))

  const currentStatus = status ?? c.status
  const currentTags   = tags ?? (c.tags as string[]) ?? []
  const changeStatus  = (v: string) => { setStatus(v); onUpdate?.(c.id, { status: v }) }

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
          onAddLocation={locationsApi.add}
          onSaveLocation={locationsApi.update} onDeleteLocation={locationsApi.remove}
          onAddDepartment={(payload, locName) => departmentsApi.add(payload, locName)}
          onUpdateDepartment={(id, payload, locName) => departmentsApi.update(id, payload, locName)}
          onRemoveDepartment={departmentsApi.remove}
          onAddContact={contactsApi.add} onUpdateContact={contactsApi.update}
        />
      )
      case 'departments':   return (
        <DepartmentsTab
          customerId={c.id} departments={departmentsApi.departments} contacts={contactsApi.contacts} locations={locationOptions} statuses={departmentStatuses}
          onAdd={departmentsApi.add} onUpdate={departmentsApi.update} onRemove={departmentsApi.remove}
        />
      )
      case 'contacts':      return (
        <ContactsTab
          contacts={contactsApi.contacts} locations={locationOptions} departments={departmentsApi.departments} statuses={contactStatuses}
          onAdd={contactsApi.add} onUpdate={contactsApi.update} onRemove={contactsApi.remove}
        />
      )
      case 'vacancies':     return <VacanciesTab customerId={c.id} />
      case 'opportunities': return <OpportunitiesTab customerId={c.id} customerName={c.name} />
      case 'planning':      return <PlanningTab customerId={c.id ?? ''} />
      case 'statistics':    return <StatisticsTab c={c} onGoToVacancies={() => setActiveTab?.('vacancies')} />
      case 'priceAgreements': return <PriceAgreementsTab customerId={c.id} />
      case 'documents':     return <DocumentsTab customerId={c.id} />
      case 'notes':         return (
        <CustomerNotesTab
          customerId={c.id} customerName={c.name} customerInitials={c.initials}
          authorInitials={authorInitials}
          notes={c.notes ?? []}
          onAddNote={payload => onAddNote?.(c.id, payload)}
        />
      )
      case 'extra':         return (
        <CustomFieldsTab entityType="customer" values={c.customFields ?? {}}
          onSave={patch => onUpdate?.(c.id, { customFields: { ...c.customFields, ...patch } })} />
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
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={c.referenceNumber} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[c.city, c.industry].filter(Boolean).join(' · ') || '—'}</div>
    </>
  )

  // Edit-pencil that toggles to save/cancel (same pattern as the candidate header).
  const iconBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }
  const headerActions = headerEditing ? (
    <>
      <button onClick={saveHeader} title={t('drawer.save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={14} /></button>
      <button onClick={() => setHeaderEditing(false)} title={t('drawer.cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={14} /></button>
    </>
  ) : (
    <button onClick={startHeaderEdit} title={t('drawer.edit')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
  )

  return (
    <EntityDrawer
      entity={c}
      initialTab={initialTab}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: c.created ? formatDateTime(c.created) : '—' })}</span>}
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), render: (setActiveTab?: (id: string) => void) => renderTab(tab.id, setActiveTab) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: logoUrl ?? c.logo, soft: true }}
          onPhotoChange={setLogoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          titleActions={<>
            <CustomerChangelog customerId={c.id} />
            {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async, never
                claims "done" (see GeocodeButton). Disabled when there's no city yet
                (the customer's own address is city-only on this flat model). */}
            <GeocodeButton endpoint={`/customers/${c.id}/geocode`} permission="customers.update" disabled={!c.city} />
          </>}
          actions={headerActions}
          meta={[
            { key: 'status', label: t('drawer.status'), value: currentStatus, width: 160,
              options: statuses.map(s => ({ value: s.value, label: s.label })), onChange: changeStatus, menuWidth: 170 },
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
  )
}
