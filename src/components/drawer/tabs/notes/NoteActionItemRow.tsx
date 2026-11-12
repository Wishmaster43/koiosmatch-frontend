/**
 * NoteActionItemRow — one action-item card of the note popup's action panel.
 * Extracted out of NoteActionsPanel (§3 split, CVPICK-NITS-1) as a dumb row:
 * the panel owns the execute wiring, this row only renders one item and
 * reports edits/confirms back through its callbacks.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Calendar, ExternalLink, ListChecks, Mail, MessageCircle, Pencil, AlertTriangle, Send } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import { humanizeIsoDates } from '@/lib/localDate'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import AssistDeclinedFace from '@/components/ui/richtext/AssistDeclinedFace'
import ProposalCvPicker from '@/components/ui/richtext/ProposalCvPicker'
import NoteActionTaskExtras from './NoteActionTaskExtras'
import type { AssistActionType } from './noteAssistApi'
import type { NoteActionPanelItem } from './NoteActionsPanel'

// One icon per action-item type — mirrors the common:notesAssist.actionTypes.* vocabulary.
const TYPE_ICON: Record<AssistActionType, typeof ListChecks> = {
  task: ListChecks, whatsapp: MessageCircle, email: Mail, appointment: Calendar, notification: Bell, application_propose: Send,
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
  budget_exceeded: 'var(--color-warning)', executing: 'var(--text-muted)', declined: 'var(--text-muted)',
}

// Renders one action's lifecycle status as a soft-tinted chip, coloured by STATUS_TONE.
function StatusChip({ status }: { status: NoteActionPanelItem['status'] }) {
  const { t } = useTranslation('common')
  // camelCase i18n key per status — budget_exceeded needs its own mapping,
  // the bare charAt-capitalize scheme would produce an invalid statusBudget_exceeded key.
  const STATUS_LABEL_KEY: Record<NoteActionPanelItem['status'], string> = {
    proposed: 'statusProposed', pending: 'statusPending', executed: 'statusExecuted', failed: 'statusFailed',
    budget_exceeded: 'statusBudgetExceeded', executing: 'statusExecuting', declined: 'statusDeclined',
  }
  const label = t(`notesAssist.panel.${STATUS_LABEL_KEY[status]}`)
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
export default function NoteActionItemRow({ item, index, onEdit, onConfirm, candidateId, formatNumber }: {
  item: NoteActionPanelItem
  index: number
  onEdit: (index: number, patch: Partial<NoteActionPanelItem>) => void
  // CLAIM-1: an optional force flag — the 'declined' card's "Toch versturen" re-posts
  // confirmed:true + force:true; every other caller omits it.
  onConfirm: (index: number, force?: boolean) => void
  candidateId?: string
  formatNumber: (n: number) => string
}) {
  const { t } = useTranslation('common')
  const [editOpen, setEditing] = useState(false)
  // The edit UI only renders while the status is editable, so a status change closes it.
  const editing = editOpen && (item.status === 'pending' || item.status === 'proposed')
  // The spinner is the hook's own `confirming` flag (via the sync effect) — it clears on every
  // response, including a "pending" answer or a rejected request (NOTE-CONFIRM-HANG-2).
  const confirming = Boolean(item.confirming)
  const Icon = TYPE_ICON[item.type] ?? ListChecks
  const dateField = item.type === 'appointment' ? item.start : item.due_date
  const link = item.status === 'executed' ? createdLink(item.created, candidateId) : undefined

  // Fired once; cleared once the item's own status moves on (the confirm
  // response landed and NoteActionsPanel's sync effect updated this prop).
  const confirm = () => onConfirm(index)
  // CLAIM-1: the 'declined' card's own re-post, with force:true alongside confirmed:true.
  const forceSend = () => onConfirm(index, true)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Icon size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={item.title} onChange={e => onEdit(index, { title: e.target.value })}
              aria-label={t('notesAssist.panel.editTitle')}
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
                aria-label={t('notesAssist.panel.editDate')}
                onChange={e => onEdit(index, { start: e.target.value })}
                style={{ marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 11.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            ) : (
              <input type="date" value={dateField ? dateField.slice(0, 10) : ''}
                aria-label={t('notesAssist.panel.editDate')}
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
          {/* Y-002: proposal CV picker, shown while editing or while the row awaits its confirm (pending), rendered once. */}
          {(editing || item.status === 'pending') && item.type === 'application_propose' && (
            <ProposalCvPicker applicationId={item.link_type === 'application' ? item.link_id : undefined}
              value={item.cv_document_id ?? null} onChange={id => onEdit(index, { cv_document_id: id })} disabled={confirming || item.preparingCv} refreshKey={item.cvRefresh} />
          )}
          {item.preparingCv && <Caption as="div">{t('notesAssist.proposeCv.preparing')}</Caption>}
          {!editing && item.type === 'task' && (item.assignee_label || item.link_label) && (
            <Caption as="div">
              {[item.assignee_label, item.link_label].filter(Boolean).join(' · ')}
            </Caption>
          )}
          {/* The AI-drafted message travels in the execute body — it must be
              READABLE before a confirm sends it (visie punt 7: nothing goes
              out unseen; mirrors AssistActionItemCard's message block). */}
          {item.message && (
            <Caption as="div" style={{ marginTop: 4, whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px' }}>
              {item.message}
            </Caption>
          )}
        </div>
        {/* Editable while proposed AND while pending — pending IS the
            decision moment before the confirm sends it (visie punt 7, r2). */}
        {(item.status === 'proposed' || item.status === 'pending') && (
          <Button variant="ghost" size="sm" iconOnly onClick={() => setEditing(v => !v)}
            aria-label={t('notesAssist.panel.edit')} title={t('notesAssist.panel.edit')}>
            <Pencil size={12} />
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <StatusChip status={item.status} />
        {(item.status === 'failed' || item.status === 'pending' || item.status === 'budget_exceeded') && item.reason && <Caption as="span" title={item.reason}>{item.reason}</Caption>}
        {/* CLAIM-1: declined — the server reason (by code) plus a chip to the
            existing proposal when it carries both a proposal_id AND an
            application link, and a force-send button that re-posts this one
            item with confirmed:true + force:true. */}
        {item.status === 'declined' && (
          <AssistDeclinedFace code={item.code} reason={item.reason}
            applicationId={item.link_type === 'application' ? item.link_id : undefined}
            proposalId={item.proposal_id} existingRef={item.ref} confirming={confirming} onForceSend={forceSend} />
        )}
        {item.status === 'pending' && item.confirmError && (
          <span role="alert"><Caption as="span" style={{ color: 'var(--color-danger-text)' }}>
            {item.confirmErrorKind === 'sessionExpired'
              ? t('notesAssist.execute.confirmSessionExpired')
              : item.confirmErrorKind === 'cvFailed'
                ? (item.confirmErrorText || t('notesAssist.proposeCv.prepareFailed'))
              : item.confirmErrorKind === 'notApplied'
                ? t('notesAssist.execute.confirmNotApplied')
                : t('notesAssist.execute.confirmFailed')}
          </Caption></span>
        )}
        {item.status === 'pending' && (
          <Button variant="soft" size="sm" onClick={confirm} disabled={confirming}>
            {confirming ? <Spinner size={11} /> : null} {t('notesAssist.panel.confirm')}
          </Button>
        )}
        {/* Budget exceeded (PRIJSMODEL-C 30-08) — no confirm button, retrying
            just re-422s (mirrors AssistActionItemCard's same-status branch). */}
        {item.status === 'budget_exceeded' && (item.budget?.used != null || item.budget?.upgrade_hint?.next_tier_label) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-warning-text)' }}>
            <AlertTriangle size={12} />
            {item.budget?.used != null && item.budget?.allowance != null && t('notesAssist.panel.budgetLine', {
              used: formatNumber(item.budget.used), allowance: formatNumber(item.budget.allowance), unit: item.budget.unit ?? '',
            })}
            {item.budget?.upgrade_hint?.next_tier_label && (
              <> · {t('notesAssist.panel.upgradeHint', { tier: item.budget.upgrade_hint.next_tier_label })}</>
            )}
          </span>
        )}
        {item.status === 'executed' && link && (
          <Button href={link} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm"
            aria-label={t('notesAssist.panel.openNew')} title={t('notesAssist.panel.openNew')}>
            <ExternalLink size={11} /> {t('notesAssist.panel.openNew')}
          </Button>
        )}
      </div>
    </div>
  )
}
