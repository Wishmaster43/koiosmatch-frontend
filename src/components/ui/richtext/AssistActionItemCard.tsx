/**
 * AssistActionItemCard — one action item's execute outcome from the shared
 * Koios "Actiepunten" wizard (promoted from the note domain,
 * CMFE-KOIOS-CONSISTENCY-1, Danny 09-08 — §11 one source, no note-only copy
 * left behind). Mirrors KoiosPendingActionCard's visual language (soft card,
 * entity chip, §4 soft-tint confirm button) — a DIFFERENT data shape
 * (per-item execute status: executed/pending/wizard_required/forbidden/
 * unsupported, not a chat pending_action id+expiry), so this is its own small
 * component rather than bending KoiosPendingActionCard's props to fit; the
 * shared LOOK is copied on purpose, never re-derived ad hoc.
 *
 * A non-executed item carries a server `reason` — shown via a native title
 * tooltip on forbidden/unsupported/wizard_required, the static per-type map
 * staying only as the fallback when it is absent. A whatsapp/email item's
 * AI-drafted `message`, and an appointment's proposed `start`, render as a
 * calm one-line preview (§4) — full text reachable via the same title tooltip
 * plus an aria-label (screen readers get the whole text even though the line
 * is visually truncated).
 */
import type { CSSProperties } from 'react'
import Button from '../Button'
import { Caption } from '../typography'
import { humanizeIsoDates } from '@/lib/localDate'
import { useTranslation } from 'react-i18next'
import { CheckSquare, MessageCircle, Mail, CalendarClock, Bell, Check, Clock, ShieldAlert, HelpCircle, ExternalLink } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { ACTION_TYPE_LABEL_NL } from './richTextAssistApi'
import type { RichTextAssistActionType } from './richTextAssistApi'
import type { ExecItem } from './useAssistActionsExecute'
import Spinner from '../Spinner'

// Icon per action-item type — its own small map (distinct concern from
// channelIcons.ts's contact-channel chip: 'appointment'/'notification' here
// have no channel equivalent, and the icon choice is presentational only).
const TYPE_ICON: Record<RichTextAssistActionType, typeof CheckSquare> = {
  task: CheckSquare, whatsapp: MessageCircle, email: Mail, appointment: CalendarClock, notification: Bell,
}

// Rights-matrix explanation per type (mirrors KoiosActionBridge::TYPE_MAP's
// permission — phrased for a recruiter, never the raw permission slug).
const FORBIDDEN_REASON_NL: Record<RichTextAssistActionType, string> = {
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
// One-line collapsed draft preview (whatsapp/email message) — never italic,
// this is real data (§4), not placeholder text.
const draftStyle: CSSProperties = {
  fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

interface AssistActionItemCardProps {
  item: ExecItem
  onConfirm: () => void
  // Present only for an 'executed' item with a run_id — opens the shared
  // workflow-run view (RunDetailDrawer); omitted items render no link.
  onViewRun?: () => void
}

export default function AssistActionItemCard({ item, onConfirm, onViewRun }: AssistActionItemCardProps) {
  const { t } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const Icon = TYPE_ICON[item.type]
  const typeLabel = t(`notesAssist.actionTypes.${item.type}`, { defaultValue: ACTION_TYPE_LABEL_NL[item.type] })
  // Only whatsapp/email items carry a draft message; only appointment items
  // carry a proposed start — both optional (older/synthetic items lack them).
  const isMessageType = item.type === 'whatsapp' || item.type === 'email'
  const draftLabel = t('notesAssist.execute.draftMessage', { defaultValue: 'Draft message' })
  const proposedTimeLabel = t('notesAssist.execute.proposedTime', { defaultValue: 'Proposed time' })

  return (
    <div style={cardStyle}>
      <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {typeLabel}{item.due_date ? ` · ${humanizeIsoDates(item.due_date)}` : ''}
          {item.type === 'appointment' && item.start ? ` · ${proposedTimeLabel}: ${formatDateTime(item.start)}` : ''}
        </div>
        {isMessageType && item.message && (
          <div style={draftStyle} title={item.message} aria-label={`${draftLabel}: ${item.message}`}>
            {item.message}
          </div>
        )}
      </div>

      {/* Executed — success + a real link to the run this action started. */}
      {item.status === 'executed' && (
        onViewRun ? (
          // Success-coloured STATUS text (state colour, not button identity) with
          // the run link on the whole affordance.
          <button type="button" onClick={onViewRun} title={t('notesAssist.execute.viewRun', { defaultValue: 'Bekijk workflow-run' })}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- status-coloured inline link-chip: success ink is the state signal (§4), Button's tones have no success ink variant
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-success-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Check size={13} /> {t('notesAssist.execute.executed', { defaultValue: 'Uitgevoerd' })} <ExternalLink size={11} />
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-success-text)' }}>
            <Check size={13} /> {t('notesAssist.execute.executed', { defaultValue: 'Uitgevoerd' })}
          </span>
        )
      )}

      {/* Pending / wizard_required — both need an explicit per-item confirm
          (wizard_required is a K3 selection-decision status not reachable from
          a plain field's own item types today, handled identically for
          forward compat). wizard_required's server reason ("Selectiebeslissing
          — …") rides on the wrapper as a title tooltip; plain pending has no
          extra reason surfaced — the button itself already says what to do. */}
      {(item.status === 'pending' || item.status === 'wizard_required') && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title={item.status === 'wizard_required' ? item.reason : undefined}>
          {item.confirmError && (
            <span style={{ fontSize: 10, color: 'var(--color-danger-text)' }}>
              {t('notesAssist.execute.confirmFailed', { defaultValue: 'Bevestigen mislukt' })}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={item.confirming} style={{ flexShrink: 0 }}>
            {item.confirming ? <Spinner size={12} /> : <Clock size={12} />}
            {t('notesAssist.execute.confirm', { defaultValue: 'Bevestigen' })}
          </Button>
        </span>
      )}

      {/* Forbidden — the rights matrix blocked it; an honest why-tooltip (the
          server's own exception message when present, the static per-type map
          only as fallback), no fake retry button (retrying would 403 again). */}
      {item.status === 'forbidden' && (
        <span title={item.reason ?? t(`notesAssist.execute.forbiddenReason.${item.type}`, { defaultValue: FORBIDDEN_REASON_NL[item.type] })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-danger-text)', cursor: 'help' }}>
          <ShieldAlert size={13} /> {t('notesAssist.execute.forbidden', { defaultValue: 'Geen rechten' })}
        </span>
      )}

      {/* Unsupported — documented by the K0 contract but not yet reachable per
          item (an unknown type currently fails the whole request instead);
          rendered honestly in case the backend starts emitting it, with its
          server reason as a tooltip when present (no static fallback exists
          for this status — there was never a reason to show before now). */}
      {item.status === 'unsupported' && (
        <Caption as="span" title={item.reason}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontStyle: 'italic' }}>
          <HelpCircle size={13} /> {t('notesAssist.execute.unsupported', { defaultValue: 'Nog niet ondersteund' })}
        </Caption>
      )}
    </div>
  )
}
