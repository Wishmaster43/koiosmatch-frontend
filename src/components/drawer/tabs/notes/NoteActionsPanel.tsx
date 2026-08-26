/**
 * NoteActionsPanel — the note popup's FIXED right-hand action-items panel
 * (ASSIST-SIDEPANEEL-1, Danny's 11-puntenvisie punt 4). Replaces the old
 * append-as-list "Actiepunten" idiom: a combined Verwerken/Samenvatten
 * assist call now returns items alongside the text, and this panel is their
 * ONE administration surface — no text ever gets appended for them any more.
 *
 * Each item goes through its own tiny lifecycle: proposed (suggested, not
 * yet sent) → pending (sent, waiting on the recruiter's own confirm — Wizard
 * mode, or Auto mode's message types) → executed (a real record now exists,
 * linked) / failed (server reason shown verbatim, never raw SQL). The panel
 * owns the execute wiring itself (`useAssistActionsExecute`, the SAME shared
 * K0-B state machine AssistActionsResultsPanel uses, §11 one source) so the
 * composer only has to hand it items and read the merged result back.
 */
import { useEffect, useRef, useState } from 'react'
import NoteActionTaskExtras from './NoteActionTaskExtras'
import { useTranslation } from 'react-i18next'
import { Bell, Calendar, ListChecks, Mail, MessageCircle, Pencil, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { GroupLabel, Caption } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import { humanizeIsoDates } from '@/lib/localDate'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import { useAssistActionsExecute } from '@/components/ui/richtext/useAssistActionsExecute'
import type { AssistActionType } from './noteAssistApi'

// One panel item — a suggested action item plus its OWN execution outcome.
// `created` only appears once the server actually made a record (executed).
export interface NoteActionPanelItem {
  title: string
  type: AssistActionType
  due_date: string | null
  note_excerpt: string | null
  message?: string | null
  start?: string | null
  status: 'proposed' | 'pending' | 'executed' | 'failed'
  reason?: string
  run_id?: string
  created?: { type: 'appointment' | 'task' | 'calllist'; id: string } | null
  // K-159 task extras (edit-before-execute): who the task is for and one
  // optional entity link — executed verbatim; labels are display-only.
  assignee_user_id?: string
  assignee_label?: string
  link_type?: string
  link_id?: string
  link_label?: string
}

interface NoteActionsPanelProps {
  items: NoteActionPanelItem[]
  onItemsChange: (items: NoteActionPanelItem[]) => void
  // Existing note id → execute's `source.note_id`; a new/unsaved note omits it.
  noteId?: string
  // Candidate the note belongs to — the fallback deep-link target for an
  // executed appointment item (no dedicated appointments page exists yet;
  // NOTE-ASSIST-1's brief documents this as the deliberate stand-in).
  candidateId?: string
  // K0 Auto mode (Danny punt 10): freshly-suggested items run immediately,
  // one automatic batch call per new suggestion — messages still park on the
  // server's own confirmation rule. Wizard mode (default/undefined) waits
  // for the explicit "Uitvoeren" click.
  autoRun?: boolean
}

// One icon per action-item type — mirrors ACTION_TYPE_LABEL_NL's vocabulary.
const TYPE_ICON: Record<AssistActionType, typeof ListChecks> = {
  task: ListChecks, whatsapp: MessageCircle, email: Mail, appointment: Calendar, notification: Bell,
}

// Where an EXECUTED item's own record lives, by its `created.type` — task and
// calllist ride existing pages; appointment has none yet, so it falls back to
// the candidate drawer (documented above and in the brief).
function createdLink(created: NoteActionPanelItem['created'], candidateId?: string): string | undefined {
  if (!created) return undefined
  if (created.type === 'task') return buildEntityDeepLink('tasks', created.id)
  if (created.type === 'calllist') return buildEntityDeepLink('outreach', created.id)
  if (created.type === 'appointment' && candidateId) return buildEntityDeepLink('candidates', candidateId)
  return undefined
}

// Status-chip tint per lifecycle state — proposed reads neutral, pending a
// warning tint, executed the house success pair, failed danger (§4).
const STATUS_TONE: Record<NoteActionPanelItem['status'], string> = {
  proposed: 'var(--text-muted)', pending: 'var(--color-warning)', executed: 'var(--color-success)', failed: 'var(--color-danger)',
}

// Renders one action's lifecycle status as a soft-tinted chip, coloured by STATUS_TONE.
function StatusChip({ status }: { status: NoteActionPanelItem['status'] }) {
  const { t } = useTranslation('common')
  const STATUS_LABEL_NL: Record<NoteActionPanelItem['status'], string> = {
    proposed: 'Voorgesteld', pending: 'Wacht op bevestiging', executed: 'Uitgevoerd', failed: 'Mislukt',
  }
  const label = t(`notesAssist.panel.status${status.charAt(0).toUpperCase()}${status.slice(1)}`, { defaultValue: STATUS_LABEL_NL[status] })
  const color = STATUS_TONE[status]
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      color: chipInk(color), background: tintBg(color, true), border: tintBorder(color, true) }}>
      {label}
    </span>
  )
}

// One editable item card — pencil toggles inline title + date/start inputs;
// edits are kept in-panel and sent VERBATIM on the next execute (the backend
// runs items[].title/message/start/due_date exactly as posted).
function ActionItemCard({ item, index, onEdit, onConfirm, candidateId }: {
  item: NoteActionPanelItem
  index: number
  onEdit: (index: number, patch: Partial<NoteActionPanelItem>) => void
  onConfirm: (index: number) => void
  candidateId?: string
}) {
  const { t } = useTranslation('common')
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Clear the local spinner once the confirm response has actually landed.
  useEffect(() => { setConfirming(false) }, [item.status])
  const Icon = TYPE_ICON[item.type] ?? ListChecks
  const dateField = item.type === 'appointment' ? item.start : item.due_date
  const link = item.status === 'executed' ? createdLink(item.created, candidateId) : undefined

  // Fired once; cleared once the item's own status moves on (the confirm
  // response landed and NoteActionsPanel's sync effect updated this prop).
  const confirm = () => { setConfirming(true); onConfirm(index) }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Icon size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={item.title} onChange={e => onEdit(index, { title: e.target.value })}
              aria-label={t('notesAssist.panel.editTitle', { defaultValue: 'Titel' })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
          ) : (
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', wordBreak: 'break-word' }}>{item.title}</div>
          )}
          {editing ? (
            // Two field shapes (backend rule): appointments carry `start`
            // (datetime); every other type carries `due_date` as Y-m-d — a
            // datetime string in due_date 422'd the whole batch (Opus round).
            item.type === 'appointment' ? (
              <input type="datetime-local" value={dateField ? dateField.slice(0, 16) : ''}
                aria-label={t('notesAssist.panel.editDate', { defaultValue: 'Datum' })}
                onChange={e => onEdit(index, { start: e.target.value })}
                style={{ marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 11.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            ) : (
              <input type="date" value={dateField ? dateField.slice(0, 10) : ''}
                aria-label={t('notesAssist.panel.editDate', { defaultValue: 'Datum' })}
                onChange={e => onEdit(index, { due_date: e.target.value })}
                style={{ marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 11.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            )
          ) : (
            dateField && <Caption as="div">{humanizeIsoDates(dateField)}</Caption>
          )}
          {/* K-159: WHO + WHAT — task items only (the bridge ignores these on
              other types), and only while editing keeps the card calm. */}
          {editing && item.type === 'task' && (
            <NoteActionTaskExtras item={item} index={index} onEdit={onEdit} />
          )}
          {!editing && item.type === 'task' && (item.assignee_label || item.link_label) && (
            <Caption as="div">
              {[item.assignee_label, item.link_label].filter(Boolean).join(' · ')}
            </Caption>
          )}
        </div>
        {item.status === 'proposed' && (
          <Button variant="ghost" size="sm" iconOnly onClick={() => setEditing(v => !v)}
            aria-label={t('notesAssist.panel.edit', { defaultValue: 'Bewerken' })} title={t('notesAssist.panel.edit', { defaultValue: 'Bewerken' })}>
            <Pencil size={12} />
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <StatusChip status={item.status} />
        {(item.status === 'failed' || item.status === 'pending') && item.reason && <Caption as="span" title={item.reason}>{item.reason}</Caption>}
        {item.status === 'pending' && (
          <Button variant="soft" size="sm" onClick={confirm} disabled={confirming}>
            {confirming ? <Spinner size={11} /> : null} {t('notesAssist.panel.confirm', { defaultValue: 'Bevestigen' })}
          </Button>
        )}
        {item.status === 'executed' && link && (
          <Button href={link} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm"
            aria-label={t('notesAssist.panel.openNew', { defaultValue: 'Open in nieuw scherm' })} title={t('notesAssist.panel.openNew', { defaultValue: 'Open in nieuw scherm' })}>
            {t('notesAssist.panel.openNew', { defaultValue: 'Open in nieuw scherm' })}
          </Button>
        )}
      </div>
    </div>
  )
}

// Renders the action list and drives its batch execute/auto-run; Wizard confirms per item, Auto runs the same path unattended.
export default function NoteActionsPanel({ items, onItemsChange, noteId, candidateId, autoRun }: NoteActionsPanelProps) {
  const { t } = useTranslation('common')
  const exec = useAssistActionsExecute(noteId ? { note_id: noteId } : {})
  const hasProposed = items.some(it => it.status === 'proposed')
  // Always-current panel items for the sync effect below (avoids re-running
  // it — and re-merging — on every panel item edit, only on exec's own
  // results changing).
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items })

  // Merge exec's live results back into the panel's own items, by title+type
  // key — runs whenever a preview()/confirm() call produces a new items
  // array on the shared execute hook. Never resets an item exec doesn't
  // mention (a previously-executed sibling stays exactly as it was).
  useEffect(() => {
    if (!exec.items) return
    const byKey = new Map(exec.items.map(r => [`${r.title}__${r.type}`, r]))
    const next = itemsRef.current.map(it => {
      const r = byKey.get(`${it.title}__${it.type}`)
      if (!r || !r.status) return it
      // Server truth only: 'failed' is a real status (K-153) and `created` is
      // the record the run made (K-157) — run_id opens nothing, and inventing
      // a created-type gave whatsapp items a link to nowhere (Opus round).
      const status: NoteActionPanelItem['status'] = r.status === 'executed' ? 'executed'
        : (r.status === 'failed' || r.status === 'forbidden' || r.status === 'unsupported' ? 'failed' : 'pending')
      return { ...it, status, reason: r.reason, run_id: r.run_id,
        created: r.created ?? it.created ?? null }
    })
    onItemsChange(next)
    // onItemsChange is the caller's setter (stable identity in practice); the
    // real trigger is exec.items itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec.items])

  // Batch "Uitvoeren" — sends every still-PROPOSED item unconfirmed; the
  // server decides executed/pending/forbidden per item (Wizard/Auto mode +
  // the rights matrix). Already-executed/failed items are left untouched;
  // the effect above merges the response back in once it lands.
  const runBatch = () => {
    const proposed = items.filter(it => it.status === 'proposed')
    if (proposed.length === 0) return
    exec.preview(proposed)
  }

  // Auto mode: fire the batch call once per fresh set of proposed items —
  // guarded by their own key set so a re-render (or an already-run batch
  // that came back all-pending) never re-triggers the same items twice.
  const autoRanKeysRef = useRef<string>('')
  // Fires the batch execute once per fresh proposed-keys set, so Auto mode never re-runs an already-handled batch on a re-render.
  useEffect(() => {
    if (!autoRun) return
    const proposedKeys = items.filter(it => it.status === 'proposed').map(it => `${it.title}__${it.type}`).sort().join('|')
    if (!proposedKeys || proposedKeys === autoRanKeysRef.current) return
    autoRanKeysRef.current = proposedKeys
    runBatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, items])

  // A single item's own "Bevestigen" — re-sends only that item confirmed
  // exec.confirm indexes into exec's OWN items array (seeded by the last
  // preview), so the panel index is looked up there by the same key.
  const confirmOne = (index: number) => {
    const target = items[index]
    if (!target || !exec.items) return
    const execIndex = exec.items.findIndex(r => r.title === target.title && r.type === target.type)
    if (execIndex >= 0) exec.confirm(execIndex)
  }

  // Inline edit — applies a patch to one item's local fields (title/date),
  // kept only in panel state until the next "Uitvoeren".
  const editItem = (index: number, patch: Partial<NoteActionPanelItem>) => {
    onItemsChange(items.map((it, i) => i === index ? { ...it, ...patch } : it))
  }

  if (items.length === 0) return null

  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <GroupLabel>{t('notesAssist.panel.title', { defaultValue: 'Actiepunten' })}</GroupLabel>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={runBatch} disabled={!hasProposed || exec.status === 'loading'}>
          {exec.status === 'loading' ? <Spinner size={12} /> : <Play size={12} />} {t('notesAssist.panel.run', { defaultValue: 'Uitvoeren' })}
        </Button>
      </div>
      {exec.status === 'error' && (
        <Caption as="div" style={{ color: 'var(--color-danger-text)' }}>{exec.errorMessage}</Caption>
      )}
      {items.map((it, i) => (
        <ActionItemCard key={`${it.title}__${it.type}__${i}`} item={it} index={i} onEdit={editItem} onConfirm={confirmOne} candidateId={candidateId} />
      ))}
    </div>
  )
}
