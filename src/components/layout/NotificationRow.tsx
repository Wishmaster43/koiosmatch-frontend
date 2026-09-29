/**
 * NotificationRow — one bell row. NOTIF-I18N-1 (Danny 29-09, bell review as
 * Kelly, EN): the title/body render in the VIEWING USER's language via
 * `notificationText`, the record the notification is about shows as a
 * deep-link chip (`KoiosRefChip`), and any `actions[]` the backend attaches
 * run through the SAME staged/confirm runner a Koios suggestion row uses
 * (§0B: "Wizard and Auto are the SAME machinery") — never a second execution
 * path. Split out of NotificationBell for size (§3) once the row grew actions
 * + a remove button on top of the existing click-through/status-line logic.
 */
import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ExternalLink } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { BodyText, Caption } from '@/components/ui/typography'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { KoiosRefChip } from './koios/KoiosResultCards'
import { ExecErrorNotice, ExecutedNotice, StagedPreview } from './koios/KoiosSuggestionExec'
import SuggestionEditor from './koios/SuggestionEditor'
import { editorFieldsForAction } from './koios/suggestionEditorSpec'
import { useRun, useStageAndConfirm } from './koios/koiosSuggestionRunner'
import type { ExecState } from './koios/koiosSuggestionRunner'
import { stagePendingAction, confirmPendingAction } from './koios/koiosApi'
import { toolIcon } from './koios/koiosSuggestionMeta'
import { askKoios } from '@/lib/koiosBridge'
import { notificationText } from './notificationText'
import {
  resolveNotificationTarget, navigateToNotificationTarget, buildNotificationDeepLink, resolveActionLine,
  resolveNotificationHref, koiosPromptOf,
} from './notificationTarget'
import type { AppNotification, NotificationAction } from '@/hooks/useNotifications'

interface Props {
  n: AppNotification
  isLast: boolean
  fmt: (iso?: string) => string
  showRemove: boolean
  onRemove?: (id: string | number) => void
  onClose: () => void
}

// The action's own args (mirrors the suggestion row's argsOf).
const argsOf = (a: NotificationAction) => a.input ?? {}

export default function NotificationRow({ n, isLast, fmt, showRemove, onRemove, onClose }: Props) {
  const { t } = useTranslation('common')
  const [exec, setExec] = useState<ExecState>({ phase: 'idle' })
  const run = useRun(setExec)
  const stageAndConfirm = useStageAndConfirm(setExec, run)

  // A row navigates only when it carries a real, resolvable target; a zip-ready
  // row carries an external signed URL instead of a record.
  const target = resolveNotificationTarget(n)
  const href = target == null ? resolveNotificationHref(n) : null
  const clickable = target != null || href != null
  // NOTIF-PAYLOAD: a workflow-run row also shows its status + next step.
  const action = resolveActionLine(n)
  const koiosPrompt = koiosPromptOf(n)
  // NOTIF-I18N-1: the title/body in the viewing user's language, falling back
  // to the server's own (bureau-language) text for a free-typed or unmapped row.
  const { title, body } = notificationText(n, t)
  const actions = n.actions ?? []
  const primary = actions[0]

  const goClick = () => { if (target) navigateToNotificationTarget(target); else if (href) window.open(href, '_blank', 'noopener,noreferrer'); onClose() }
  const goKeyDown = (e: ReactKeyboardEvent) => {
    // Only the row itself (not a child control/input) triggers row-navigation —
    // otherwise Enter/Space on any action button, the trash icon or an inline
    // editor field would bubble up and hijack the keypress into a navigate (§6).
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goClick() }
  }

  // TASK-CREATE-EDIT-1 idiom: an action with a known editor spec (reschedule_task)
  // opens the inline editor first; anything else stages straight away.
  const runAction = (a: NotificationAction) => {
    const hasEditor = Boolean(editorFieldsForAction(a.key, typeof argsOf(a).due_date === 'string'))
    if (hasEditor) setExec({ phase: 'editing', editingAction: a })
    else void stageAndConfirm(stagePendingAction, confirmPendingAction, a.tool, argsOf(a))
  }

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? goClick : undefined}
      onKeyDown={clickable ? goKeyDown : undefined}
      style={{
        padding: '10px 16px', borderBottom: isLast ? 'none' : '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', gap: 8,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <BodyText style={{ fontWeight: n.seen ? 400 : 600 }}>{title || '—'}</BodyText>
        {body && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{body}</div>}
        {/* NOTIF-I18N-1: the record this notification is about — a deep-link chip
            under the title, never repeated inside the title itself. */}
        {/* record.label is null when the record is unresolved (cross-tenant/deleted)
            — a labelless chip has nothing to show, so render nothing rather than an
            empty icon-only button. Closing the dropdown mirrors the row's own click:
            the chip just opened the drawer behind it, so leaving the panel open over
            it is the fake-affordance case (§3). */}
        {n.record?.label && (
          <span onClick={(e: ReactMouseEvent) => { e.stopPropagation(); onClose() }} style={{ alignSelf: 'flex-start' }}>
            <KoiosRefChip item={{ type: n.record.type, id: n.record.id, label: n.record.label }} />
          </span>
        )}
        {action && (
          // K-192: next_action is a KEY, rendered only for the two known
          // keys — an unknown/null key shows the status line alone.
          <Caption>
            {t(`notifications.actionStatus.${action.status}`)}{action.nextAction ? ` ${t(`notifications.nextAction.${action.nextAction}`)}` : ''}
          </Caption>
        )}
        <Caption>{fmt(n.created_at)}</Caption>
        {/* X-31: "ask Koios" prefills the panel with the row's prompt (never auto-sent,
            API-CREDITS-1) — rendered only when the row carries one. */}
        {koiosPrompt && (
          <div style={{ marginTop: 4 }}>
            <Button variant="ghost" size="sm"
              onClick={(e: ReactMouseEvent) => { e.stopPropagation(); askKoios(koiosPrompt); onClose() }}>
              <KoiosAiMark tone="soft" size={12} /> {t('notifications.askKoios')}
            </Button>
          </div>
        )}
        {/* NOTIF-I18N-1: executable actions, same shape/runner as a Koios suggestion row. */}
        {actions.length > 0 && exec.phase === 'idle' && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={(e: ReactMouseEvent) => e.stopPropagation()}>
            {actions.map(a => {
              const Ico = toolIcon(a)
              const label = t(a.label_key, { defaultValue: t(a.tool_label_key, { defaultValue: t('koios.tools.unknown') }) })
              return (
                <Button key={a.key} size="sm" variant={a === primary ? 'secondary' : 'ghost'} iconOnly
                  onClick={() => runAction(a)} aria-label={label} title={label}>
                  <Ico size={13} />
                </Button>
              )
            })}
          </div>
        )}
        {exec.phase === 'editing' && exec.editingAction && (
          <div onClick={(e: ReactMouseEvent) => e.stopPropagation()}>
            <SuggestionEditor
              action={exec.editingAction}
              onConfirm={(input) => { void stageAndConfirm(stagePendingAction, confirmPendingAction, exec.editingAction!.tool, input) }}
              onCancel={() => setExec({ phase: 'idle' })}
            />
          </div>
        )}
        {(exec.phase === 'staged' || (exec.phase === 'submitting' && exec.staged)) && (
          <div onClick={(e: ReactMouseEvent) => e.stopPropagation()}><StagedPreview exec={exec} setExec={setExec} /></div>
        )}
        {exec.phase === 'staging' && <span style={{ display: 'flex' }}><Spinner size={12} /></span>}
        {exec.phase === 'executed' && <ExecutedNotice created={exec.created} t={t} />}
        {exec.phase === 'error' && <ExecErrorNotice message={exec.message} budget={exec.budget} t={t} />}
      </div>
      {/* EntityLink idiom: the row name navigates in-app, this icon opens
          the same record's deep link in a new browser tab. */}
      {clickable && (
        <Button href={target ? buildNotificationDeepLink(target) : href!} target="_blank" rel="noopener noreferrer"
          onClick={(e: ReactMouseEvent) => e.stopPropagation()} variant="ghost" iconOnly size="sm"
          title={t('openInNewTab')} aria-label={t('openInNewTab')}
          style={{ flexShrink: 0, opacity: 0.65, marginTop: 2 }}>
          <ExternalLink size={12} />
        </Button>
      )}
      {/* NOTIF-I18N-1: per-row delete — only once the backend actually sends the new shape. */}
      {showRemove && onRemove && (
        <Button size="sm" variant="ghost" iconOnly onClick={(e: ReactMouseEvent) => { e.stopPropagation(); onRemove(n.id) }}
          aria-label={t('notifications.remove')} title={t('notifications.remove')}
          style={{ flexShrink: 0, opacity: 0.65, marginTop: 2 }}>
          <Trash2 size={12} />
        </Button>
      )}
    </div>
  )
}
