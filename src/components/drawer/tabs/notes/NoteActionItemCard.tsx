/**
 * NoteActionItemCard — one note-assist action item's execute outcome (K0-B,
 * F4). Mirrors KoiosPendingActionCard's visual language (soft card, entity
 * chip, §4 soft-tint confirm button) — a DIFFERENT data shape (per-item
 * execute status: executed/pending/wizard_required/forbidden/unsupported,
 * not a chat pending_action id+expiry), so this is its own small component
 * rather than bending KoiosPendingActionCard's props to fit; the shared LOOK
 * is copied on purpose, never re-derived ad hoc.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, MessageCircle, Mail, CalendarClock, Bell, Check, Clock, ShieldAlert, HelpCircle, ExternalLink, Loader2 } from 'lucide-react'
import { ACTION_TYPE_LABEL_NL } from './noteAssistApi'
import type { AssistActionType } from './noteAssistApi'
import type { ExecItem } from './useNoteActionsExecute'

// Icon per action-item type — its own small map (distinct concern from
// channelIcons.ts's contact-channel chip: 'appointment'/'notification' here
// have no channel equivalent, and the icon choice is presentational only).
const TYPE_ICON: Record<AssistActionType, typeof CheckSquare> = {
  task: CheckSquare, whatsapp: MessageCircle, email: Mail, appointment: CalendarClock, notification: Bell,
}

// Rights-matrix explanation per type (mirrors KoiosActionBridge::TYPE_MAP's
// permission — phrased for a recruiter, never the raw permission slug).
const FORBIDDEN_REASON_NL: Record<AssistActionType, string> = {
  task: 'Je hebt geen rechten om taken aan te maken.',
  whatsapp: 'Je hebt geen rechten om WhatsApp-berichten te versturen.',
  email: 'Je hebt geen rechten om deze actie namens de kandidaat uit te voeren.',
  appointment: 'Je hebt geen rechten om deze actie namens de kandidaat uit te voeren.',
  notification: 'Je hebt geen rechten om deze actie uit te voeren.',
}

const cardStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12,
}
const confirmBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
  padding: '4px 9px', borderRadius: 6, cursor: 'pointer', border: 'none',
  background: 'var(--color-primary)', color: '#fff', flexShrink: 0,
}

interface NoteActionItemCardProps {
  item: ExecItem
  onConfirm: () => void
  // Present only for an 'executed' item with a run_id — opens the shared
  // workflow-run view (RunDetailDrawer); omitted items render no link.
  onViewRun?: () => void
}

export default function NoteActionItemCard({ item, onConfirm, onViewRun }: NoteActionItemCardProps) {
  const { t } = useTranslation('common')
  const Icon = TYPE_ICON[item.type]
  const typeLabel = t(`notesAssist.actionTypes.${item.type}`, { defaultValue: ACTION_TYPE_LABEL_NL[item.type] })

  return (
    <div style={cardStyle}>
      <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {typeLabel}{item.due_date ? ` · ${item.due_date}` : ''}
        </div>
      </div>

      {/* Executed — success + a real link to the run this action started. */}
      {item.status === 'executed' && (
        onViewRun ? (
          <button type="button" onClick={onViewRun} title={t('notesAssist.execute.viewRun', { defaultValue: 'Bekijk workflow-run' })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-success)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Check size={13} /> {t('notesAssist.execute.executed', { defaultValue: 'Uitgevoerd' })} <ExternalLink size={11} />
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-success)' }}>
            <Check size={13} /> {t('notesAssist.execute.executed', { defaultValue: 'Uitgevoerd' })}
          </span>
        )
      )}

      {/* Pending / wizard_required — both need an explicit per-item confirm
          (wizard_required is a K3 selection-decision status not reachable from
          a note's own item types today, handled identically for forward compat). */}
      {(item.status === 'pending' || item.status === 'wizard_required') && (
        <>
          {item.confirmError && (
            <span style={{ fontSize: 10, color: 'var(--color-danger)' }}>
              {t('notesAssist.execute.confirmFailed', { defaultValue: 'Bevestigen mislukt' })}
            </span>
          )}
          <button type="button" onClick={onConfirm} disabled={item.confirming} style={{ ...confirmBtn, opacity: item.confirming ? 0.6 : 1 }}>
            {item.confirming ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
            {t('notesAssist.execute.confirm', { defaultValue: 'Bevestigen' })}
          </button>
        </>
      )}

      {/* Forbidden — the rights matrix blocked it; an honest why-tooltip, no
          fake retry button (retrying would 403 again). */}
      {item.status === 'forbidden' && (
        <span title={t(`notesAssist.execute.forbiddenReason.${item.type}`, { defaultValue: FORBIDDEN_REASON_NL[item.type] })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-danger)', cursor: 'help' }}>
          <ShieldAlert size={13} /> {t('notesAssist.execute.forbidden', { defaultValue: 'Geen rechten' })}
        </span>
      )}

      {/* Unsupported — documented by the K0 contract but not yet reachable per
          item (an unknown type currently fails the whole request instead);
          rendered honestly in case the backend starts emitting it. */}
      {item.status === 'unsupported' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          <HelpCircle size={13} /> {t('notesAssist.execute.unsupported', { defaultValue: 'Nog niet ondersteund' })}
        </span>
      )}
    </div>
  )
}
