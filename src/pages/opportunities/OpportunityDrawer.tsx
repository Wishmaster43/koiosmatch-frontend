import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trophy, Ban } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import { useDateFormat } from '@/lib/datetime'
import DetailsTab from './drawer/DetailsTab'
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
}

const hdrBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 }
const hdrGhost: CSSProperties = { ...hdrBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
const hdrPrimary: CSSProperties = { ...hdrBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }

/**
 * OpportunityDrawer — thin container (mirror VacancyDrawer/CandidateDrawer): wires
 * lookups + onUpdate and declares the header config + tab list. Stage/owner/customer
 * edit through the header pickers; the title edits inline; Won/Lost are quick actions
 * (the sales equivalent of the candidate "convert"). onUpdate(id, patch) uses UI keys
 * that the data hook maps to API keys.
 */
export default function OpportunityDrawer({
  opportunity: o, onClose, expanded, onToggleExpand, onUpdate, stages = [], users = [], customers = [],
}: OpportunityDrawerProps) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()

  // Inline title edit — reset when a different opportunity is shown (render-time pattern).
  const [editing,    setEditing]    = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [prevId,     setPrevId]     = useState<Id | undefined>(o?.id)
  if (o?.id !== prevId) { setPrevId(o?.id); setEditing(false); setTitleDraft('') }

  if (!o) return null

  // Owner picker — include the current owner so it shows even if not in `users`.
  const ownerOptions = [
    ...(users.some(u => u.id === o.ownerId) || !o.owner ? [] : [{ value: o.ownerId, label: o.owner }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]
  const clientOptions = customers.map(c => ({ value: c.id, label: c.name }))
  const stageOptions  = stages.map(s => ({ value: s.value, label: s.label }))

  // Terminal-stage quick actions (Won/Lost) — driven by the lookup flags, never hardcoded.
  const wonStage  = stages.find(s => s.isWon)
  const lostStage = stages.find(s => s.isLost)
  const isWon  = !!wonStage  && o.stageValue === wonStage.value
  const isLost = !!lostStage && o.stageValue === lostStage.value

  const startEdit = () => { setTitleDraft(o.title); setEditing(true) }
  const saveEdit  = () => { const v = titleDraft.trim(); if (v && v !== o.title) onUpdate?.(o.id, { title: v }); setEditing(false) }

  const tabs = [
    { id: 'details',   label: t('drawer.tabs.details'),   render: () => <DetailsTab opportunity={o} onUpdate={onUpdate} /> },
    { id: 'changelog', label: t('drawer.tabs.changelog'), render: () => <ChangelogTab opportunity={o} /> },
  ]

  const renderTitle = () => editing ? (
    <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 15, fontWeight: 700,
        borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text)' }} />
  ) : (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{o.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.client || '—'}</div>
      {o.expectedCloseAt && !isWon && !isLost && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('drawer.expectedCloseOn', { date: formatDate(o.expectedCloseAt) })}</div>
      )}
    </>
  )

  const actions = (
    <>
      {/* Won/Lost quick actions — only when a terminal stage is configured + not already there. */}
      {wonStage && !isWon && (
        <button onClick={() => onUpdate?.(o.id, { stageValue: wonStage.value })} title={t('drawer.markWon')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
            border: '1px solid var(--color-success)', background: 'var(--color-success)', color: '#fff' }}>
          <Trophy size={11} /> {t('drawer.markWon')}
        </button>
      )}
      {lostStage && !isLost && (
        <button onClick={() => onUpdate?.(o.id, { stageValue: lostStage.value })} title={t('drawer.markLost')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}>
          <Ban size={11} /> {t('drawer.markLost')}
        </button>
      )}
      {editing ? (
        <>
          <button onClick={saveEdit} title={t('common:save')} style={hdrPrimary}><Save size={14} /></button>
          <button onClick={() => setEditing(false)} title={t('common:cancel')} style={hdrGhost}><X size={14} /></button>
        </>
      ) : (
        <button onClick={startEdit} title={t('common:edit')} style={hdrGhost}><Edit2 size={13} /></button>
      )}
    </>
  )

  return (
    <EntityDrawer
      entity={o}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDate(o.date) || '—' })}</span>}
      tabs={tabs}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: o.initials, soft: true }}
          renderTitle={renderTitle}
          actions={actions}
          meta={[
            { key: 'stage', label: t('drawer.stage'), value: o.stageValue,
              options: stageOptions, placeholder: t('drawer.selectStage'),
              onChange: (val: string) => onUpdate?.(o.id, { stageValue: val }), menuWidth: 180, width: 170 },
            { key: 'owner', label: t('drawer.owner'), value: o.ownerId,
              options: ownerOptions, placeholder: t('drawer.selectOwner'),
              onChange: (val: string) => onUpdate?.(o.id, { ownerId: val }), menuWidth: 200, width: 180 },
            { key: 'client', label: t('drawer.client'), value: o.clientId,
              options: clientOptions, placeholder: t('drawer.selectClient'),
              onChange: (val: string) => onUpdate?.(o.id, { clientId: val }), menuWidth: 220, width: 200 },
          ]}
        />
      )}
    />
  )
}
