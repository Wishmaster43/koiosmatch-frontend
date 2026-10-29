/**
 * ThreadComposerBlock — the per-thread composer branch of ConversationsSection
 * (ONIX-RECHECK #15): free text plus the window/queue hint inside the open 24h
 * session (or any wa_web thread), the template composer outside it. Pure
 * presentation: the draft, the send and the window state arrive as props.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock } from 'lucide-react'
import { Caption } from '@/components/ui/typography'
import ConversationAssistSection from './ConversationAssistSection'
import ThreadComposer from './ThreadComposer'
import TemplateComposer from './TemplateComposer'
import { windowLeftParts, type SessionWindowState } from './sessionWindow'
import { isWaWeb, rowSubject, type ConversationRow } from './conversationRows'

interface ThreadComposerBlockProps {
  row: ConversationRow
  win: SessionWindowState
  hasMessages: boolean
  composerEnabled: boolean
  // K-008: an optional line rendered once above the composer (e.g. the privacy-notice hint).
  composerNotice?: ReactNode
  draft: string
  onDraftChange: (text: string) => void
  sending: boolean
  sendError: string | null
  onSend: () => void
  onTemplateSent: () => void
  formatDateTime: (iso: string) => string
  language: string
}

// Composer for one open thread: free text in-window, template picker outside it.
export default function ThreadComposerBlock({ row, win, hasMessages, composerEnabled, composerNotice, draft, onDraftChange,
  sending, sendError, onSend, onTemplateSent, formatDateTime, language }: ThreadComposerBlockProps) {
  const { t } = useTranslation('candidates')
  const left = windowLeftParts(win.msLeft)
  return (
    <>
    {/* WHATSAPP-COMPOSE-1 / WA-WINDOW-1: free text inside the open 24h window,
        a template picker outside it. Both branches SAY which one applies and
        why — the recruiter never faces a missing input without an answer.
        WA-THREAD-UX-1: a wa_web thread has no session gate at all — it always
        gets the free-text composer, with a hint that it goes through the queue. */}
    {composerEnabled && (win.open || isWaWeb(row.primary_channel) ? (
      <>
        {/* K-008: the notice rides only a free-text send; a template send defers it. */}
        {composerNotice}
        {/* WA-THREAD-UX-1: a wa_web thread never faces the 24h gate — say so
            instead of reusing the window countdown that only applies to WABA. */}
        {isWaWeb(row.primary_channel) ? (
          <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Clock size={12} style={{ flexShrink: 0 }} />
            <span>{t('conversations.waWebComposerHint')}</span>
          </Caption>
        ) : (
          // WA-WINDOW-1: how long free text is still allowed, plus the exact
          // closing moment on hover — derived from this row's own
          // last_inbound_at, the very field the backend gates on.
          <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}
            title={win.expiresAt ? t('conversations.windowClosesAt', { time: formatDateTime(win.expiresAt) }) : undefined}>
            <Clock size={12} style={{ flexShrink: 0 }} />
            {/* Under a minute reads as "less than a minute" — "0 minuten left"
                while the window is demonstrably still open would be a lie. */}
            <span>{left.hours > 0
              ? t('conversations.windowLeftHours', { hours: left.hours, minutes: left.minutes })
              : left.minutes > 0
                ? t('conversations.windowLeftMinutes', { count: left.minutes })
                : t('conversations.windowLeftSeconds')}</span>
          </Caption>
        )}
        {/* G27: the Koios AI assist affordance — gated on the SAME open-session
            condition as the composer itself, so "Overnemen" always writes into a
            visibly rendered draft input (never an invisible/pending state). */}
        <ConversationAssistSection conversationId={row.id} hasMessages={hasMessages}
          onApply={onDraftChange} language={language} />
        {/* WA-COMPOSER-1: the multi-line, auto-growing composer with the
            bold/italic/strikethrough + emoji toolbar (Danny's F5, 19-09) —
            Enter still sends, Shift+Enter still inserts a newline. */}
        <ThreadComposer value={draft} onChange={onDraftChange} onSend={() => onSend()}
          sending={sending} placeholder={t('conversations.composerPlaceholder')} />
        {/* WA-SEND-TRANSPORT-1: the 409/502 inline explanation — role="alert" so
            assistive tech announces it, icon + text so colour is never the only cue. */}
        {sendError && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--color-danger-text)' }}>
            <AlertTriangle size={11} style={{ flexShrink: 0 }} />
            {sendError}
          </div>
        )}
      </>
    ) : (
      // WA-WINDOW-1 (Danny punt 12): outside the window Meta only accepts an
      // approved template — so the answer to "how do I reach them?" is right
      // here, instead of one muted sentence and a dead end.
      <TemplateComposer subject={rowSubject(row)}
        windowKnown={win.known} onSent={() => onTemplateSent()} />
    ))}

    </>
  )
}
