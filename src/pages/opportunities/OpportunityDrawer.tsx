import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import TrashLifecycleSection from '@/components/drawer/TrashLifecycleSection'
import type { TrashSectionConfig } from '@/components/drawer/TrashLifecycleSection'
import TitleBadge from '@/components/drawer/TitleBadge'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import Button from '@/components/ui/Button'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import DetailsTab from './drawer/DetailsTab'
import CustomerRelationTab from './drawer/CustomerRelationTab'
import NotesTab from './drawer/NotesTab'
import TasksTab from './drawer/TasksTab'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import type { Opportunity } from '@/types/opportunity'
import type { Id, LookupOption } from '@/types/common'

interface DrawerUser { id: Id; name: string }
interface DrawerCustomer { id: Id; name: string }
type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

interface OpportunityDrawerProps {
  opportunity: Opportunity | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: UpdateFn
  stages?: LookupOption[]
  users?: DrawerUser[]
  customers?: DrawerCustomer[]
  // ARCHIVE-1: per-id soft-delete/restore (§7 — UI-only gate; the backend
  // re-checks opportunities.delete / opportunities.update). Absent = no
  // permission, so the trash icon/restore button simply don't render.
  onArchive?: (id: Id | undefined) => void
  onRestore?: (id: Id | undefined) => void
  // TRASH-OVERAL-2: the shared trash-section wiring (mark/unmark, see TrashLifecycleSection).
  trash?: TrashSectionConfig
}

/**
 * OpportunityDrawer — thin container mirroring the candidate drawer: a calm header
 * (colour-coded phase BADGE next to the title, a changelog ICON, one owner + one
 * phase picker — no wall of pickers), and config tabs (Details · Customer · Notes ·
 * Tasks). The customer lives in its own tab; record history is the changelog icon,
 * not a tab. Outcome (Won/Lost) is read from the phase, not a separate button.
 */
export default function OpportunityDrawer({
  opportunity: o, onClose, expanded, onToggleExpand, onUpdate, stages = [], users = [], customers = [],
  onArchive, onRestore, trash,
}: OpportunityDrawerProps) {
  const { t } = useTranslation('opportunities')
  const { formatDate, formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined opportunity custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('opportunity')

  // Inline title edit — reset when a different opportunity is shown (render-time pattern).
  const [editing,    setEditing]    = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [prevId,     setPrevId]     = useState<Id | undefined>(o?.id)
  // Tags are edited inline; seed from the record and reset when a different
  // opportunity is shown (mirrors VacancyDrawer's tag handling). UpdateOpportunityRequest
  // accepts `tags` (grepped app/Http/Requests/Opportunity/OpportunityRequest.php).
  const [tags, setTags] = useState<string[] | null>(null)
  if (o?.id !== prevId) { setPrevId(o?.id); setEditing(false); setTitleDraft(''); setTags(null) }

  if (!o) return null

  const currentTags = tags ?? o.tags ?? []
  const setTagsAndSave = (next: string[]) => { setTags(next); onUpdate?.(o.id, { tags: next }) }

  const ownerOptions = [
    ...(users.some(u => String(u.id) === String(o.ownerId)) || !o.owner ? [] : [{ value: o.ownerId, label: o.owner }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]
  const stageOptions = stages.map(s => ({ value: s.value, label: s.label }))

  const startEdit = () => { setTitleDraft(o.title); setEditing(true) }
  const saveEdit  = () => { const v = titleDraft.trim(); if (v && v !== o.title) onUpdate?.(o.id, { title: v }); setEditing(false) }

  const tabs = [
    { id: 'details', label: t('drawer.tabs.details'), render: () => <DetailsTab opportunity={o} onUpdate={onUpdate} stages={stages} /> },
    { id: 'customer', label: t('drawer.tabs.customer'), render: () => <CustomerRelationTab opportunity={o} customers={customers} onUpdate={onUpdate} /> },
    { id: 'notes',   label: t('drawer.tabs.notes'),   render: () => <NotesTab opportunity={o} /> },
    { id: 'tasks',   label: t('drawer.tabs.tasks'),   render: () => <TasksTab opportunity={o} /> },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra'), render: () => (
      <CustomFieldsTab entityType="opportunity" values={o.customFieldValues ?? {}}
        onSave={patch => onUpdate?.(o.id, { customFieldValues: { ...o.customFieldValues, ...patch } })} />
    ) }] : []),
  ]

  const renderTitle = () => editing ? (
    <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 15, fontWeight: 700,
        borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
  ) : (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{o.title}</div>
        {/* NUMMER-3: the copy chip, right after the title and before the phase badge (§3A). */}
        <ReferenceNumberChip value={o.referenceNumber} />
        {/* Phase = colour-coded read-only badge (shows Gewonnen/Verloren at a glance). */}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.client || '—'}</div>
      {o.expectedCloseAt && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('drawer.expectedCloseOn', { date: formatDate(o.expectedCloseAt) })}</div>
      )}
    </>
  )

  // Header actions = just inline title edit (no Won/Lost buttons — outcome is the
  // phase). ARCHIVED: no title edit on a soft-deleted deal — restore first.
  const actions = o.archived ? null : editing ? (
    <>
      <Button variant="primary" iconOnly size="sm" onClick={saveEdit} title={t('common:save')}><Save size={14} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={() => setEditing(false)} title={t('common:cancel')}><X size={14} /></Button>
    </>
  ) : (
    <Button variant="secondary" iconOnly size="sm" onClick={startEdit} title={t('common:edit')}><Edit2 size={13} /></Button>
  )

  return (
    <EntityDrawer
      entity={o}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8)): created-at left, empty right (consistent spacing
      // with the candidate/other drawers even when there is no right-side content).
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(o.date) })}</span>
          <span />
        </div>
      }
      tabs={tabs}
      header={() => (
        <EntityHeader
          // TITEL-CHIP-1 (Danny 19-08): the stage badge IS the title.
          label={<TitleBadge label={o.stage} color={o.stageColor} />}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice (mirrors the shared Avatar.tsx NEUTRAL_AVATAR constant)
          avatar={{ initials: o.initials, soft: true, color: '#9CA3AF' }}
          renderTitle={renderTitle}
          titleActions={<>
            {/* Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
                cramped 360px dropdown with no focus trap; now the same 900px centred
                panel as the candidate drawer. */}
            <ChangelogPopover><ChangelogTab opportunity={o} /></ChangelogPopover>
            {/* ARCHIVE-1: per-id soft-delete (mirrors candidates' trash icon in the
                title row) — hidden once already archived; the banner below takes over. */}
            {onArchive && !o.archived && (
              <Button variant="dangerSoft" iconOnly size="sm" onClick={() => onArchive(o.id)}
                title={t('drawer.archive')} aria-label={t('drawer.archive')}>
                <Trash2 size={14} />
              </Button>
            )}
          </>}
          actions={actions}
          // Standard picker widths (§3A blueprint: Status/Stage ~160 + Eigenaar ~190).
          // ARCHIVED: no stage/owner changes on a soft-deleted deal — restore first.
          meta={o.archived ? [] : [
            { key: 'stage', label: t('drawer.stage'), value: o.stageValue,
              options: stageOptions, placeholder: t('drawer.selectStage'),
              onChange: (val: string) => onUpdate?.(o.id, { stageValue: val }), menuWidth: 170, width: 160 },
            { key: 'owner', label: t('drawer.owner'), value: o.ownerId,
              options: ownerOptions, placeholder: t('drawer.selectOwner'),
              onChange: (val: string) => onUpdate?.(o.id, { ownerId: val }), menuWidth: 200, width: 190 },
          ]}
          // C-41: free-form tags — UpdateOpportunityRequest accepts `tags` (measured).
          tags={{ items: currentTags, onAdd: tag => setTagsAndSave([...currentTags, tag]),
            onRemove: tag => setTagsAndSave(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Archived banner (ARCHIVE-1): since-when + restore, right under the header —
              server-backed (mapOpportunity reads archived/deleted_at, see the type
              comment on Opportunity.archived) OR set locally the moment this session's
              own archive/restore call completes, whichever lands first. */}
          {/* TRASH-OVERAL-2: hidden once the record sits in the trash — the trash
              banner (TrashLifecycleSection) takes over with unmark instead. */}
          {o.archived && o.lifecycle !== 'pending_erase' && (
            <ArchivedBanner id={o.id}
              message={o.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(o.archivedAt) }) : t('drawer.archivedBanner.flag')}
              onRestore={onRestore} restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: the shared mark/unmark surface (permission-gated in `trash`). */}
          {trash && (
            <TrashLifecycleSection entityPath="opportunities" id={o.id} entityLabel={o.title}
              lifecycle={o.lifecycle} pendingEraseAt={o.pendingEraseAt} {...trash} />
          )}
        </EntityHeader>
      )}
    />
  )
}
