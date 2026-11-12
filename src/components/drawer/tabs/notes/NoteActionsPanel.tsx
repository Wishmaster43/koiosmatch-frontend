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
import { useEffect, useRef } from 'react'
import NoteActionItemRow from './NoteActionItemRow'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { GroupLabel, Caption } from '@/components/ui/typography'
import { useAssistActionsExecute } from '@/components/ui/richtext/useAssistActionsExecute'
import { useNumberFormat } from '@/lib/formatters'
import type { AssistActionType } from './noteAssistApi'
import type { ActionBudget } from '@/types/actionBudget'
import type { Id } from '@/types/common'

// One panel item — a suggested action item plus its OWN execution outcome.
// `created` only appears once the server actually made a record (executed).
export interface NoteActionPanelItem {
  title: string
  type: AssistActionType
  due_date: string | null
  note_excerpt: string | null
  message?: string | null
  // Position of this item in exec's own array, stamped at merge time —
  // survives a later title edit (see confirmOne).
  execIndex?: number
  // NOTE-ACTION-ITEMS-1: the persisted row's id — execute sends it (with the
  // note id) so the server stamps status/created onto the stored item.
  noteActionItemId?: string
  start?: string | null
  // 'budget_exceeded' added PRIJSMODEL-C 30-08: the tenant's workflow-run
  // staffel is full — its own terminal branch, never a retry (mirrors the
  // rich-text AssistActionItemCard's vocabulary, §11 one source).
  // CLAIM-1 (03-10): 'executing' (another request already claimed this item's
  // run) and 'declined' (a duplicate application_propose inside the server's
  // 10-minute window) — their own terminal/transient branches, mirroring the
  // rich-text AssistActionItemCard's vocabulary (§11 one source).
  status: 'proposed' | 'pending' | 'executed' | 'failed' | 'budget_exceeded' | 'executing' | 'declined'
  reason?: string
  // CLAIM-1: present only on status === 'declined' — the machine code to
  // branch on, and the existing proposal this duplicate collided with.
  // KOIOS-DEDUPE-1 widens the vocabulary to `duplicate_<entity>[_archived]`.
  code?: string | null
  proposal_id?: Id | null
  // KOIOS-DEDUPE-1: the existing record a duplicate decline collided with.
  ref?: { type: string; id: Id; archived?: boolean } | null
  budget?: ActionBudget
  run_id?: string
  created?: { type: 'appointment' | 'task' | 'calllist'; id: string } | null
  // NOTE-CONFIRM-HANG-2: the per-item confirm state comes from the execute hook, never from a
  // card-local flag — a confirm the server answered with "pending" again used to leave the
  // card's own spinner on forever because nothing about the item changed.
  confirming?: boolean
  confirmError?: boolean
  confirmErrorKind?: 'failed' | 'sessionExpired' | 'notApplied'
  // K-159 task extras (edit-before-execute): who the task is for and one
  // optional entity link — executed verbatim; labels are display-only.
  assignee_user_id?: string
  assignee_label?: string
  link_type?: string
  link_id?: string
  link_label?: string
  // Y-002: the saved proposal CV an application_propose row sends.
  cv_document_id?: string | null
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

// Renders the action list and drives its batch execute/auto-run; Wizard confirms per item, Auto runs the same path unattended.
export default function NoteActionsPanel({ items, onItemsChange, noteId, candidateId, autoRun }: NoteActionsPanelProps) {
  const { t } = useTranslation('common')
  const { formatNumber } = useNumberFormat()
  // The dossier's candidate rides on every execute call (NOTE-CONFIRM-HANG-2): the note may not
  // be saved yet, so note_id alone can be absent — candidate_id is what makes the created
  // appointment/task land on THIS person.
  const exec = useAssistActionsExecute({ ...(noteId ? { note_id: noteId } : {}), ...(candidateId ? { candidate_id: candidateId } : {}) })
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
      const execIndex = exec.items!.indexOf(r)
      // Server truth only: 'failed' is a real status (K-153) and `created` is
      // the record the run made (K-157) — run_id opens nothing, and inventing
      // a created-type gave whatsapp items a link to nowhere (Opus round).
      // 'budget_exceeded' (PRIJSMODEL-C 30-08) gets its OWN branch, checked
      // before the pending catch-all — a budget-full item must never render
      // as "wacht op bevestiging" with a confirm button that just re-422s.
      const status: NoteActionPanelItem['status'] = r.status === 'executed' ? 'executed'
        : r.status === 'budget_exceeded' ? 'budget_exceeded'
        : r.status === 'executing' ? 'executing'
        : r.status === 'declined' ? 'declined'
        : (r.status === 'failed' || r.status === 'forbidden' || r.status === 'unsupported' ? 'failed' : 'pending')
      return { ...it, status, reason: r.reason, run_id: r.run_id, execIndex,
        budget: r.budget ?? it.budget,
        code: r.code, proposal_id: r.proposal_id, ref: r.ref,
        created: r.created ?? it.created ?? null,
        confirming: r.confirming, confirmError: r.confirmError, confirmErrorKind: r.confirmErrorKind }
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
  // Sends the PANEL's current item (late edits included) at the exec index
  // stamped during the merge — a title edit no longer breaks the lookup and
  // the confirm can never resend a stale pre-edit copy (r2 punt-7 gat).
  // A persisted pending item (note reopened, no preview in this mount) confirms too: the hook
  // seeds its own list from the override when it has none (NOTE-CONFIRM-HANG-2).
  const confirmOne = (index: number, force?: boolean) => {
    const target = items[index]
    if (!target) return
    const execIndex = target.execIndex ?? (exec.items ? exec.items.findIndex(r => r.title === target.title && r.type === target.type) : -1)
    exec.confirm(execIndex >= 0 ? execIndex : 0, target, force)
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
        <GroupLabel>{t('notesAssist.panel.title')}</GroupLabel>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={runBatch} disabled={!hasProposed || exec.status === 'loading'}>
          {exec.status === 'loading' ? <Spinner size={12} /> : <Play size={12} />} {t('notesAssist.panel.run')}
        </Button>
      </div>
      {exec.status === 'error' && (
        <Caption as="div" style={{ color: 'var(--color-danger-text)' }}>{exec.errorMessage}</Caption>
      )}
      {items.map((it, i) => (
        <NoteActionItemRow key={`${it.title}__${it.type}__${i}`} item={it} index={i} onEdit={editItem} onConfirm={confirmOne} candidateId={candidateId} formatNumber={formatNumber} />
      ))}
    </div>
  )
}
