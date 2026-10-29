/**
 * ConversationsSection — shared WhatsApp conversation thread panel
 * (CONV-DRILLDOWN-FE, promoted to components/drawer/ for GESPREK-CONTACT-1):
 * originally the candidate's Communicatie → Conversaties sub-tab, now reused
 * by any dossier that has a conversations list endpoint. The caller decides
 * WHICH threads to list via `threadsUrl` (+ optional `threadsParams`); this
 * component owns the accordion, auto-expand and the per-thread messages fetch
 * (`/conversations/{id}/messages`), which is the same endpoint for every caller.
 *
 * UI strings live on the 'candidates' i18n namespace — ONE source, both
 * dossiers reuse them (never duplicate the `conversations.*` keys into
 * 'customers'). Health-adjacent PII (§8): nothing is logged; we only render
 * what the screen needs.
 *
 * G27 / K2-CONV-ASSIST-1: an open session thread also renders
 * `ConversationAssistSection` (Koios AI summarize/actions over the thread's
 * own stored messages) right above the send input — "Overnemen" writes
 * straight into `composerText`, the very same draft the input below sends.
 *
 * WA-WINDOW-1 (Danny punt 12, 08-08): the window state is now SPOKEN OUT LOUD
 * instead of implied. Inside the window the composer carries how much time is
 * left; outside it the free-text input is replaced by `TemplateComposer` — the
 * only route Meta actually allows there — so the recruiter never has to guess
 * why the input disappeared or how to reach the candidate anyway.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useDateFormat } from '@/lib/datetime'
import ConversationMessage from './ConversationMessage'
import ThreadComposerBlock from './ThreadComposerBlock'
import { CHANNEL_COLORS, HANDLED_BY_COLORS } from './channelColors'
import { sessionWindow } from './sessionWindow'
import { candidateFullName } from './conversationRows'
import { useConversationThreads } from './useConversationThreads'
import { useConversationSend, useQueuedMessageRefresh } from './useConversationSend'
import { useThreadViewPrefs } from './useThreadViewPrefs'
import type { Id } from '@/types/common'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'

// WA-SEND-TRANSPORT-1 (landed 06-08, verified by reading MessageController::store /
// sendSessionReply, read-only reference in koiosmatch-api): an outbound POST
// /conversations/{id}/messages WITHOUT a wamid now runs through the real
// WhatsAppBundleSender pipeline (24h window, Governor, consent, dedup — Meta FIRST,
// the row only after) instead of writing a "sent" bubble nobody received. The
// controller answers 201 once Meta actually accepted it, 409 when the sender itself
// declined (window closed / governor cap / opt-out / dedup — its own Dutch reason),
// and 502 when Meta/the gateway is unreachable. A "sent" bubble now really reaches
// the candidate, so the composer is ON for every caller.
const SESSION_COMPOSER_ENABLED = true

export default function ConversationsSection({ threadsUrl, threadsParams, headerAction, badgeApplicationId, composerEnabled = SESSION_COMPOSER_ENABLED, composerNotice }: {
  // The list request the caller wants — candidate scope passes '/conversations' +
  // { candidate_id }, the contact variant passes its nested contact-conversations route.
  threadsUrl: string
  threadsParams?: Record<string, unknown>
  // Test-only override for the WA-SEND-TRANSPORT-1 gate above.
  composerEnabled?: boolean
  // K-008: an optional line rendered once above the composer (e.g. the privacy-notice hint).
  composerNotice?: ReactNode
  // WHATSAPP-COMPOSE-1: an optional caller-supplied action for the section header
  // (e.g. the candidate drawer's "Conversatie starten" trigger) — mirrors
  // SectionCard's own action slot so this stays a candidate-only affordance without
  // the shared component knowing WHY (a customer-contact thread has none).
  headerAction?: ReactNode
  // GESPREK-CONSISTENT-1-FE: marks the one thread (if any) that carries this
  // application's id with an extra chip — the reader stays the candidate-wide
  // list, this only highlights which row belongs to the caller's application.
  badgeApplicationId?: Id
}) {
  // thread UI strings live in the candidates ns — ONE source, both dossiers reuse them
  const { t, i18n } = useTranslation('candidates')
  const { formatDate, formatDateTime } = useDateFormat()
  const { rows, loading, error, openId, toggle, messages, setMessages, msgLoading, msgError, retryMessages, refreshRows, reloadThread } =
    useConversationThreads(threadsUrl, threadsParams)
  const { composerText, setComposerText, sendingMsg, sendError, sendMessage } = useConversationSend(openId, setMessages, refreshRows)
  const { nowMs, sortOrder, changeSortOrder, sortMessages } = useThreadViewPrefs()
  // Scrolls the open thread's message list to the edge holding the newest message.
  const messageListRef = useRef<HTMLDivElement | null>(null)
  useQueuedMessageRefresh(openId, rows, messages, setMessages)

  // WA-THREAD-UX-1: after every render of the open thread's messages, scroll to
  // the edge holding the newest one — the bottom when oldest-first, the top when
  // newest-first — so a long thread never opens buried mid-scroll.
  useEffect(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTop = sortOrder === 'oldest' ? el.scrollHeight : 0
  }, [openId, messages, sortOrder])

  // K-193 channel chip (thread header): the enum→token map is shared with the
  // message bubble (ConversationMessage); an unknown channel renders no chip.
  const channelChip = (channel?: string, channelLabel?: string | null) => {
    // No badge for an unrecognized/unknown channel — never render a raw enum code.
    const color = channel ? CHANNEL_COLORS[channel] : undefined
    if (!color) return null
    const label = t(`conversations.channel.${channel}`, { defaultValue: channelLabel ?? '' })
    return <SoftChip label={label} color={color} />
  }
  // Active-window badge (setting `conversation_active_weeks`) — green when active, muted otherwise.
  const activeBadge = (active?: boolean) => (
    <SoftChip label={active ? t('conversations.active') : t('conversations.inactive')}
      color={active ? 'var(--color-success)' : 'var(--text-muted)'} />
  )

  return (
    // No title: the host sub-tab bar already says "Conversaties" (Danny addendum 4).
    // headerAction is the candidate drawer's own "Conversatie starten" trigger, when supplied.
    <SectionCard action={headerAction}>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.loading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('conversations.error')}</div>}
      {!loading && !error && rows.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <MessageCircle size={14} style={{ opacity: 0.6 }} /> {t('sections.conversationsEmpty')}
        </div>
      )}

      {!loading && !error && rows.map(row => {
        const isOpen = openId === row.id
        const msgs = messages[String(row.id)] ?? []
        // Name over number: fall back to the raw wa_number (or an explicit "unknown" label)
        // only when the candidate identity isn't on the row; the number then stays as subtext.
        const name = candidateFullName(row)
        const heading = name || row.owner?.name || row.wa_number || t('conversations.unknownContact')
        const showNumberSub = Boolean(name) && Boolean(row.wa_number)
        // WA-WINDOW-1: this thread's 24h state, recomputed each minute tick so the
        // countdown stays true and the composer flips to templates the moment it closes.
        const win = sessionWindow(row.last_inbound_at, nowMs)
        return (
          <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: 'var(--bg)', overflow: 'hidden' }}>
            {/* Thread header — candidate name (number as subtext), last-activity date, active + escalated badges. */}
            {/* NECESSITY: full-width accordion thread-header row (icon + name + badges
                layout), not an action button — Button's fixed footprint cannot host it
                (block-form disable: the flagged style attribute sits on the tag's 2nd line). */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
            <button onClick={() => toggle(row.id)} title={t('conversations.openThread')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
              {isOpen ? <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <MessageCircle size={13} style={{ color: 'var(--color-success-text)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {heading}
                </span>
                {showNumberSub && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.wa_number}
                  </span>
                )}
              </span>
              {channelChip(row.primary_channel, row.channel_label)}
              {/* GESPREK-CONSISTENT-1-FE: marks the one thread stamped with the
                  caller's own application id — never a filter, just a highlight. */}
              {badgeApplicationId != null && row.application_id === badgeApplicationId && (
                <SoftChip label={t('conversations.thisApplication')} color="var(--color-primary)" />
              )}
              {row.escalated && (
                <SoftChip label={t('conversations.escalated')} color="var(--color-warning)" />
              )}
              {activeBadge(row.is_active)}
              {/* PUNT-2: who holds the last turn in this conversation — the tooltip carries the explanation. */}
              {row.last_handled_by && HANDLED_BY_COLORS[row.last_handled_by] && (
                <span title={t('conversations.lastTurn')}>
                  <SoftChip label={t(`conversations.handledBy.${row.last_handled_by}`)}
                    color={HANDLED_BY_COLORS[row.last_handled_by]} />
                </span>
              )}
              {row.last_message_at && <Caption as="span" style={{ whiteSpace: 'nowrap' }}>{formatDate(row.last_message_at)}</Caption>}
            </button>

            {/* Expanded: the thread's messages as bubbles (inbound left, outbound right). */}
            {isOpen && (
              <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {msgLoading && !messages[String(row.id)] && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.loadingMessages')}</div>
                )}
                {/* A failed load is never shown as the same text as a genuinely empty thread (§8 D8).
                    Shared ErrorBanner subtle variant — same face as CustomFieldsTab's error row. */}
                {!msgLoading && msgError[String(row.id)] && (
                  <ErrorBanner variant="subtle" onRetry={() => retryMessages(row.id)}>
                    {t('conversations.messagesError')}
                  </ErrorBanner>
                )}
                {!msgError[String(row.id)] && messages[String(row.id)] && msgs.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.noMessages')}</div>
                )}
                {/* WA-THREAD-UX-1: an oldest/newest switch above the list — one preference
                    per user (localStorage), never per thread — plus a scroll box so a long
                    thread never pushes the composer off screen. */}
                {msgs.length > 0 && (
                  <SegmentedControl size="compact" ariaLabel={t('conversations.sortLabel')}
                    value={sortOrder} onChange={changeSortOrder}
                    options={[
                      { value: 'oldest', label: t('conversations.sortOldestFirst') },
                      { value: 'newest', label: t('conversations.sortNewestFirst') },
                    ]} />
                )}
                {/* A capped scroll box is a focus stop (WCAG 2.1.1, the TableScrollFrame idiom):
                    keyboard users scroll it with the arrow keys once it has focus, and it names itself. */}
                <div ref={isOpen ? messageListRef : undefined} role="region" tabIndex={0} aria-label={t('conversations.messagesRegion')}
                  style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortMessages(msgs).map(m => (
                    <ConversationMessage key={m.id} message={m} formatDateTime={formatDateTime} />
                  ))}
                </div>

                <ThreadComposerBlock row={row} win={win} hasMessages={msgs.length > 0} composerEnabled={composerEnabled}
                  composerNotice={composerNotice} draft={composerText} onDraftChange={setComposerText}
                  sending={sendingMsg} sendError={sendError} onSend={() => sendMessage(row.id)}
                  onTemplateSent={() => reloadThread(row.id)} formatDateTime={formatDateTime} language={i18n.language} />
              </div>
            )}
          </div>
        )
      })}

      {/* Escalated-thread hint: a subtle note so the recruiter knows a human took over. */}
      {!loading && !error && rows.some(r => r.escalated) && (
        <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <AlertTriangle size={12} style={{ color: 'var(--color-warning-text)' }} /> {t('conversations.escalatedHint')}
        </Caption>
      )}
    </SectionCard>
  )
}
