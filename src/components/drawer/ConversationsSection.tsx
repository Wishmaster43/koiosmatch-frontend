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
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, AlertTriangle, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useDateFormat } from '@/lib/datetime'
import ConversationAssistSection from './ConversationAssistSection'
import ConversationMessage, { type MessageRow } from './ConversationMessage'
import ThreadComposer from './ThreadComposer'
import { mergeLandedMessages, type PendingMessage } from './conversationThreadMerge'
import { CHANNEL_COLORS, HANDLED_BY_COLORS } from './channelColors'
import TemplateComposer from './TemplateComposer'
import type { ConversationSubject } from './useWhatsAppTemplateSend'
import { sessionWindow, windowLeftParts } from './sessionWindow'
import type { Id } from '@/types/common'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'

// How often the "time left in the window" line re-reads the clock. One minute is
// the display resolution, so anything faster would only burn renders.
const WINDOW_TICK_MS = 60_000

// WA-THREAD-UX-1 (verifier fix): bounded backoff for the queued-refresh poll below
// (GEO-POLL-1 idiom) — a wa_web send is drained on a minute cadence, so the first
// couple of reads stay at that pace, then back off; an honest cap (~11.5 min total)
// stops a stuck outbox row from polling forever. The focus listener stays unbounded
// since it only fires on a real user action.
const QUEUED_REFRESH_DELAYS_MS = [60_000, 60_000, 120_000, 240_000, 300_000]

// WA-THREAD-UX-1: per-user message-order preference, remembered across drawers
// (never per-thread — Danny 20-09 asked for one switch the recruiter sets once).
const SORT_STORAGE_KEY = 'km:conversation-sort'
type MessageSort = 'oldest' | 'newest'

// Read the stored sort preference; a private window / blocked storage falls
// back to the default silently (§9 localStorage contract).
function readStoredSort(): MessageSort {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY)
    return v === 'newest' ? 'newest' : 'oldest'
  } catch {
    return 'oldest'
  }
}

// The candidate identity carried on a conversation row — drives the thread heading (name over number).
interface ConversationCandidate {
  id?: Id
  first_name?: string | null
  last_name?: string | null
}

// CONTACT-CONVERSATION-START: the ConversationResource-normalized owner block
// (ConversationResource::ownerShape, koiosmatch-api) — one shape whichever of the
// two nullable owner columns is actually populated, so a caller never has to guess.
interface ConversationOwner {
  type: 'candidate' | 'customer_contact'
  id: Id
  name?: string | null
}

// One conversation thread as the list endpoint returns it (only the fields the panel shows).
interface ConversationRow {
  id: Id
  // WA-WINDOW-1: the thread's own candidate — what POST /conversations/start needs
  // to send a template once the window has closed (measured on GET /conversations).
  candidate_id?: Id | null
  // GESPREK-CONTACT-1: the other possible owner (mutually exclusive with candidate_id).
  customer_contact_id?: Id | null
  // CONTACT-CONVERSATION-START: the normalized owner, when the API returns it.
  owner?: ConversationOwner | null
  wa_number?: string | null
  last_message_at?: string | null
  // WHATSAPP-COMPOSE-1: the 24h session anchor (ConversationResource / Conversation
  // migration comment) — the ONLY signal that gates the free-text composer below.
  last_inbound_at?: string | null
  is_active?: boolean
  escalated?: boolean
  candidate?: ConversationCandidate | null
  // K-193: the thread's dominant channel (enum) + server label, badge fallback source.
  primary_channel?: 'waba' | 'waba_coex' | 'wa_web' | string
  channel_label?: string | null
  // PUNT-2: "last turn" semantics — owner of the last message (including the inbound stamp).
  last_handled_by?: string | null
  // GESPREK-CONSISTENT-1-FE (KLEIN-BE-2, hand-written — the spec carries no 2xx
  // schema for GET /conversations yet): the application this thread was started
  // from, or was stamped with by an in-window interview send. Nullable context.
  application_id?: Id | null
}

// WA-THREAD-UX-1: a locally-synthesized stub for a wa_web send still `queued` at
// the drainer — never a guess at the server's eventual message id.
// Prefer the candidate's real name over the raw WhatsApp number for the thread heading.
const candidateFullName = (row: ConversationRow) =>
  [row.candidate?.first_name, row.candidate?.last_name].filter(Boolean).join(' ').trim()

// CONTACT-CONVERSATION-START: this thread's owner as {kind,id} for the template
// composer — prefers the normalized `owner` block, falls back to the older
// candidate_id/nested-candidate/customer_contact_id fields for a partial API shape.
// Null only when neither owner is known at all (a genuine dead end).
const rowSubject = (row: ConversationRow): ConversationSubject | null => {
  if (row.owner) return { kind: row.owner.type, id: row.owner.id }
  const candidateId = row.candidate_id ?? row.candidate?.id
  if (candidateId) return { kind: 'candidate', id: candidateId }
  if (row.customer_contact_id) return { kind: 'customer_contact', id: row.customer_contact_id }
  return null
}

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

export default function ConversationsSection({ threadsUrl, threadsParams, headerAction, badgeApplicationId, composerEnabled = SESSION_COMPOSER_ENABLED }: {
  // The list request the caller wants — candidate scope passes '/conversations' +
  // { candidate_id }, the contact variant passes its nested contact-conversations route.
  threadsUrl: string
  threadsParams?: Record<string, unknown>
  // Test-only override for the WA-SEND-TRANSPORT-1 gate above.
  composerEnabled?: boolean
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
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Which thread is expanded, and its lazily-loaded messages keyed by conversation id.
  const [openId, setOpenId] = useState<Id | null>(null)
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({})
  const [msgLoading, setMsgLoading] = useState(false)
  // Per-thread message-load failure, distinct from the empty-array "genuinely no
  // messages yet" state (§8 D8: a swallowed fetch error must never render as empty).
  const [msgError, setMsgError] = useState<Record<string, boolean>>({})
  // WHATSAPP-COMPOSE-1: the session composer's draft text + in-flight state — a
  // single shared slot is enough since the accordion only ever has one open thread.
  const [composerText, setComposerText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  // WA-SEND-TRANSPORT-1: the 409/502 inline explanation shown next to the composer —
  // never a toast, so it survives on screen next to the draft the recruiter can retry.
  const [sendError, setSendError] = useState<string | null>(null)
  // WA-WINDOW-1: a ticking "now" so the remaining-window line counts down while the
  // drawer stays open, instead of freezing on the value it had at first render.
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  // WA-THREAD-UX-1: oldest/newest order, one preference per user (localStorage),
  // never per thread.
  const [sortOrder, setSortOrder] = useState<MessageSort>(readStoredSort)
  // Scrolls the open thread's message list to the edge holding the newest message.
  const messageListRef = useRef<HTMLDivElement | null>(null)
  // WA-THREAD-UX-1 (verifier fix): how many backoff steps the CURRENT still-pending
  // send set has used, keyed on that set so a new send (or one landing) resets it.
  const attemptRef = useRef<{ key: string; count: number }>({ key: '', count: 0 })

  // Persist the sort choice and read it back defensively (a blocked/private
  // storage must never throw into the render path).
  const changeSortOrder = useCallback((value: string) => {
    const next: MessageSort = value === 'newest' ? 'newest' : 'oldest'
    setSortOrder(next)
    try { localStorage.setItem(SORT_STORAGE_KEY, next) } catch { /* private window / blocked storage: preference just doesn't persist */ }
  }, [])

  // Re-read the clock every minute for the countdown above (§9: the interval is set
  // up AND torn down inside the effect, so StrictMode's double mount is harmless).
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), WINDOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Serialize the caller's params so a fresh object literal each render doesn't
  // retrigger the fetch — only the actual VALUES (e.g. candidate_id) matter.
  const paramsKey = JSON.stringify(threadsParams ?? {})

  // Load this dossier's threads; a 404/422 (filter not built) reads as empty, not broken.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    setOpenId(null); setMessages({})
    api.get(threadsUrl, { params: threadsParams })
      .then(r => { if (alive) setRows(unwrapList<ConversationRow>(r).rows) })
      .catch(e => { if (!alive) return; if ([404, 422].includes(e?.response?.status)) setRows([]); else setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- threadsParams itself is intentionally excluded: paramsKey (its serialized value) is the real dependency, so an inline object literal from the caller never retriggers a spurious refetch
  }, [threadsUrl, paramsKey])

  // Auto-expand: a single thread opens immediately; with several, the first (most recent/
  // active) does. Never leaves a closed accordion the recruiter has to click through first.
  useEffect(() => {
    if (rows.length > 0) setOpenId(prev => (prev !== null ? prev : rows[0].id))
  }, [rows])

  // Flip a thread open/closed — the accordion keeps at most one thread expanded at a time.
  const toggle = useCallback((id: Id) => {
    setOpenId(prev => (prev === id ? null : id))
  }, [])

  // Bumped by the retry button below so the load effect re-runs for a thread whose
  // messages are still unset after a failed fetch (openId alone wouldn't change).
  const [msgRetryNonce, setMsgRetryNonce] = useState(0)
  const retryMessages = useCallback((id: Id) => {
    setMsgError(e => ({ ...e, [String(id)]: false }))
    setMsgRetryNonce(n => n + 1)
  }, [])

  // Fetch a thread's messages once it becomes the open one (auto-expand triggers this on mount too).
  useEffect(() => {
    if (openId === null || messages[String(openId)]) return
    let alive = true
    setMsgLoading(true); setMsgError(e => ({ ...e, [String(openId)]: false }))
    api.get(`/conversations/${openId}/messages`)
      .then(r => { if (alive) setMessages(m => ({ ...m, [String(openId)]: unwrapList<MessageRow>(r).rows })) })
      .catch(() => { if (alive) setMsgError(e => ({ ...e, [String(openId)]: true })) })
      .finally(() => { if (alive) setMsgLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages read only to skip a duplicate fetch, not a re-trigger; msgRetryNonce IS the re-trigger for a manual retry
  }, [openId, msgRetryNonce])

  // A newly opened thread starts with a clean draft — never leaks the previous
  // thread's unsent text (or its stale send error) into the one now expanded.
  useEffect(() => { setComposerText(''); setSendError(null) }, [openId])

  // WHATSAPP-COMPOSE-1 / WA-SEND-TRANSPORT-1: free-text send INSIDE the open 24h
  // session, through the same /conversations/{id}/messages route the backend gates
  // real session sends on. 201 appends the server's own returned row (never an
  // optimistic guess) and refreshes the thread list so last_message_at/is_active
  // reflect the server's own state. 409 (sender declined: window/governor/opt-out/
  // dedup) and 502 (Meta/gateway unreachable) are NOT sent — both render inline next
  // to the still-there draft instead of a toast, so a retry is just hitting send again.
  // WA-THREAD-UX-1: a wa_web send instead answers 202 {outbox_id, status: 'queued'}
  // (measured 13-09/20-09) — there is no full message row yet, so a queued send
  // renders a local stub carrying `_pendingOutboxId` (never a fabricated `id`
  // pretending to be the server's) until the refresh timer below pulls the real row.
  const sendMessage = useCallback((id: Id) => {
    const text = composerText.trim()
    if (!text) return
    setSendingMsg(true)
    setSendError(null)
    api.post(`/conversations/${id}/messages`, { direction: 'outbound', message_content: text })
      .then(r => {
        const res = r as { status?: number; data?: MessageRow & { outbox_id?: Id } }
        if (res.status === 202 && res.data?.outbox_id != null) {
          // Queued for the minute drainer: append a stub bubble marked pending so
          // the queued-refresh effect below knows to keep polling this thread.
          const stub: PendingMessage = {
            id: `pending-${res.data.outbox_id}`, direction: 'outbound', message_content: text,
            // No sent_at: the server said "queued", so the bubble shows the queued marker,
            // never a timestamp plus a "Verzonden" tick it has not earned (verifier round 2).
            sent_at: null, _pendingOutboxId: res.data.outbox_id,
          }
          setMessages(m => ({ ...m, [String(id)]: [...(m[String(id)] ?? []), stub] }))
        } else if (res.data) {
          setMessages(m => ({ ...m, [String(id)]: [...(m[String(id)] ?? []), res.data as MessageRow] }))
        }
        setComposerText('')
        // Refresh this dossier's threads after a real send — last_message_at/is_active
        // now come from the server, never a locally guessed bump.
        api.get(threadsUrl, { params: threadsParams })
          .then(rr => setRows(unwrapList<ConversationRow>(rr).rows))
          .catch(() => {})
      })
      .catch(err => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 409) {
          // Not sent: the sender itself declined — its own Dutch reason is the accurate
          // explanation (§9: readable sentence, only carries ids).
          setSendError(extractApiError(err, t('conversations.composerSendFailed')))
        } else if (status === 502) {
          // Meta/the gateway itself unreachable — an honest, translated retry notice.
          setSendError(t('conversations.composerUnavailable'))
        } else {
          notifyError(extractApiError(err, t('conversations.composerSendFailed')))
        }
      })
      .finally(() => setSendingMsg(false))
  }, [composerText, t, threadsUrl, threadsParams])

  // WA-WINDOW-1: after a template send the SERVER wrote the outbound row — pull the
  // thread and the list back in rather than guessing a bubble into place.
  const reloadThread = useCallback((id: Id) => {
    api.get(`/conversations/${id}/messages`)
      .then(r => setMessages(m => ({ ...m, [String(id)]: unwrapList<MessageRow>(r).rows })))
      .catch(() => {})
    api.get(threadsUrl, { params: threadsParams })
      .then(rr => setRows(unwrapList<ConversationRow>(rr).rows))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same paramsKey rationale as the load effect above
  }, [threadsUrl, paramsKey])

  // WA-THREAD-UX-1: a wa_web thread has no 24h session gate — the server queues
  // and drains via POST /conversations/{id}/messages at any time, so the composer
  // never falls back to the WABA template picker for this channel.
  const isWaWeb = (channel?: string) => channel === 'wa_web'

  // WA-THREAD-UX-1: sort the open thread's own messages by sent_at (the field the
  // API actually returns — MessageRow carries no created_at); an unparsed/missing
  // stamp keeps its original server-order position instead of being reshuffled.
  const sortMessages = useCallback((list: MessageRow[]): MessageRow[] => {
    const withIndex = list.map((m, index) => ({ m, index }))
    withIndex.sort((a, b) => {
      const ta = a.m.sent_at ? new Date(a.m.sent_at).getTime() : NaN
      const tb = b.m.sent_at ? new Date(b.m.sent_at).getTime() : NaN
      if (Number.isNaN(ta) || Number.isNaN(tb)) return a.index - b.index
      return sortOrder === 'oldest' ? ta - tb : tb - ta
    })
    return withIndex.map(({ m }) => m)
  }, [sortOrder])

  // WA-THREAD-UX-1: after every render of the open thread's messages, scroll to
  // the edge holding the newest one — the bottom when oldest-first, the top when
  // newest-first — so a long thread never opens buried mid-scroll.
  useEffect(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTop = sortOrder === 'oldest' ? el.scrollHeight : 0
  }, [openId, messages, sortOrder])

  // WA-THREAD-UX-1 (F3, verifier fix): a wa_web thread's last send can still be
  // `queued` while the minute drainer works through it — refetch this thread's
  // messages on a backing-off cadence (GEO-POLL-1 idiom, honest cap — never a fixed
  // window sized to yesterday's latency), and again whenever the tab regains focus,
  // so the bubble flips to sent/failed without a manual reload. The refetch MERGES
  // (mergeLandedMessages) rather than replaces, so a read that resolves before the
  // drain wrote its row never makes the just-sent bubble disappear. attemptRef
  // tracks how far into the backoff this exact set of still-pending sends has gone;
  // it resets the moment the pending set itself changes (a new send, or one landing).
  useEffect(() => {
    if (openId === null) return
    const openRow = rows.find(r => r.id === openId)
    if (!isWaWeb(openRow?.primary_channel)) return
    const openMsgs = messages[String(openId)] ?? []
    const pendingIds = openMsgs
      .map(m => (m as PendingMessage)._pendingOutboxId)
      .filter((id): id is Id => id != null)
      .sort()
    if (pendingIds.length === 0) return
    const key = `${openId}:${pendingIds.join(',')}`
    if (attemptRef.current.key !== key) attemptRef.current = { key, count: 0 }
    const refetch = () => {
      api.get(`/conversations/${openId}/messages`)
        .then(r => setMessages(m => ({
          ...m,
          [String(openId)]: mergeLandedMessages(unwrapList<MessageRow>(r).rows, m[String(openId)] ?? []),
        })))
        .catch(() => {})
    }
    window.addEventListener('focus', refetch)
    // Cap reached: keep the focus refetch (user-driven, cheap) but stop the timer.
    if (attemptRef.current.count >= QUEUED_REFRESH_DELAYS_MS.length) {
      return () => window.removeEventListener('focus', refetch)
    }
    const delay = QUEUED_REFRESH_DELAYS_MS[attemptRef.current.count]
    const timer = setTimeout(() => { attemptRef.current.count += 1; refetch() }, delay)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refetch) }
  }, [openId, rows, messages])

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
        const left = windowLeftParts(win.msLeft)
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

                {/* WHATSAPP-COMPOSE-1 / WA-WINDOW-1: free text inside the open 24h window,
                    a template picker outside it. Both branches SAY which one applies and
                    why — the recruiter never faces a missing input without an answer.
                    WA-THREAD-UX-1: a wa_web thread has no session gate at all — it always
                    gets the free-text composer, with a hint that it goes through the queue. */}
                {composerEnabled && (win.open || isWaWeb(row.primary_channel) ? (
                  <>
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
                    <ConversationAssistSection conversationId={row.id} hasMessages={msgs.length > 0}
                      onApply={setComposerText} language={i18n.language} />
                    {/* WA-COMPOSER-1: the multi-line, auto-growing composer with the
                        bold/italic/strikethrough + emoji toolbar (Danny's F5, 19-09) —
                        Enter still sends, Shift+Enter still inserts a newline. */}
                    <ThreadComposer value={composerText} onChange={setComposerText} onSend={() => sendMessage(row.id)}
                      sending={sendingMsg} placeholder={t('conversations.composerPlaceholder')} />
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
                    windowKnown={win.known} onSent={() => reloadThread(row.id)} />
                ))}
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
