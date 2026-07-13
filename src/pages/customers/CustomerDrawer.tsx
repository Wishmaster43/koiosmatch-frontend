/**
 * CustomerDrawer — thin container for the customer detail. Wires data (header
 * config + tab list) onto the shared EntityDrawer/EntityHeader shell; all heavy
 * UI lives in one small component per tab under drawer/. Mirrors CandidateDrawer.
 *
 * The Planning tab is gated on the Planning module (same gate as the candidate
 * Planning tab); the Opportunities tab's flex-shift section is gated inside it.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Edit2, Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import NotesTab from '@/components/drawer/tabs/NotesTab'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useNoteTypes } from '@/lib/useNoteTypes'
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
]

interface DrawerUser { id: Id; name: string; avatar_color?: string }
type NotePayload = { type: string; title: string; body: string }

interface CustomerDrawerProps {
  customer: Customer | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void
  onAddSub?: (kind: string, c: Customer) => void
  onAddNote?: (id: Id | undefined, payload: NotePayload) => void
  users?: DrawerUser[]
  statuses?: LookupOption[]
}

export default function CustomerDrawer({
  customer: c, onClose, expanded, onToggleExpand, onUpdate, onAddSub, onAddNote,
  users = [], statuses = [],
}: CustomerDrawerProps) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  const { formatDate } = useDateFormat()
  // Note types from the tenant lookup; author = the signed-in user (both mirror the candidate).
  const { writableTypes: noteTypes } = useNoteTypes()
  const authorInitials = initialsOf(auth?.user?.name ?? '')

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

  if (!c) return null

  // Enter/save the header name edit; save flows through the optimistic onUpdate.
  const startHeaderEdit = () => { setHeaderName(c.name ?? ''); setHeaderEditing(true) }
  const saveHeader = () => { if (headerName.trim()) onUpdate?.(c.id, { name: headerName.trim() }); setHeaderEditing(false) }

  // Planning tab only for tenants with the Planning module (same gate as sidebar).
  const tabs = TABS.filter(tab => tab.id !== 'planning' || hasModule('plan'))

  const currentStatus = status ?? c.status
  const currentTags   = tags ?? (c.tags as string[]) ?? []
  const changeStatus  = (v: string) => { setStatus(v); onUpdate?.(c.id, { status: v }) }

  // Owner (account manager) picker — current value first, then the user list.
  const ownerOptions = [
    ...(owner ? [] : [{ value: '__current', label: c.owner || '—', initials: c.ownerInitials }]),
    ...users.map(u => ({ value: u.id, label: u.name, initials: initialsOf(u.name) })),
  ]
  const ownerValue = String(owner?.id ?? '__current')
  const onOwnerChange = (id: string) => {
    if (id === '__current') return
    const u = users.find(x => String(x.id) === id)
    if (u) { setOwner({ ...u }); onUpdate?.(c.id, { ownerId: u.id, owner: u.name, ownerInitials: initialsOf(u.name), ownerColor: u.avatar_color ?? null }) }
  }

  const renderTab = (id: string): ReactNode => {
    switch (id) {
      case 'overview':      return <OverviewTab c={c} onSave={v => onUpdate?.(c.id, v)} />
      case 'locations':     return <LocationsTab customerId={c.id} locations={c.locations} onAdd={() => onAddSub?.('locations', c)} />
      case 'departments':   return <DepartmentsTab customerId={c.id} departments={c.departments} onAdd={() => onAddSub?.('departments', c)} />
      case 'contacts':      return <ContactsTab contacts={c.contacts} onAdd={() => onAddSub?.('contacts', c)} />
      case 'vacancies':     return <VacanciesTab customerId={c.id} />
      case 'opportunities': return <OpportunitiesTab customerId={c.id} />
      case 'planning':      return <PlanningTab customerId={c.id ?? ''} />
      case 'statistics':    return <StatisticsTab c={c} />
      case 'priceAgreements': return <PriceAgreementsTab customerId={c.id} />
      case 'documents':     return <DocumentsTab customerId={c.id} />
      case 'notes':         return (
        <NotesTab
          notes={c.notes ?? []}
          noteTypes={noteTypes}
          authorInitials={authorInitials} timelineName="" timelineInitials={authorInitials}
          onAddNote={payload => onAddNote?.(c.id, payload)}
          labels={{
            notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
            save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
            notesEmpty: t('notes.notesEmpty'), timeline: t('notes.timeline'), timelineEmpty: t('notes.timelineEmpty'),
            conversations: t('notes.conversations'), conversationsEmpty: t('notes.conversationsEmpty'),
            notePlaceholder: () => t('notes.notePlaceholder'),
          }}
        />
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
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: c.created ? formatDate(c.created) : '—' })}</span>}
      tabs={tabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), render: () => renderTab(tab.id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: c.initials, photo: logoUrl ?? c.logo, soft: true }}
          onPhotoChange={setLogoUrl}
          photoLabels={{ upload: t('drawer.photoUpload'), remove: t('drawer.photoRemove') }}
          renderTitle={renderTitle}
          titleActions={<CustomerChangelog customerId={c.id} />}
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
