/**
 * ConversationsSection — the candidate's WhatsApp conversations in the
 * Communicatie → Conversaties sub-tab (CONV-DRILLDOWN-FE). Replaces the old
 * hardcoded-empty placeholder that never called the endpoint: it fetches the
 * real threads for this candidate and lets you expand one to read its messages.
 *
 * Data: GET /conversations?candidate_id={id} (native-first candidate relation,
 * setting-driven `is_active`, carries the candidate identity for the thread
 * heading), then GET /conversations/{id}/messages on expand — each message now
 * carries `sent_by` (the recruiter/agent), `delivered_at` and `read_at`.
 * Health-adjacent PII (§8): nothing is logged; we only render what the screen needs.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, AlertTriangle, ChevronDown, ChevronRight, Check, CheckCheck } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { avatarColor } from '@/lib/avatarColor'
import type { Id } from '@/types/common'

// The candidate identity carried on a conversation row — drives the thread heading (name over number).
interface ConversationCandidate {
  id?: Id
  first_name?: string | null
  last_name?: string | null
}

// One conversation thread as GET /conversations returns it (only the fields the panel shows).
interface ConversationRow {
  id: Id
  wa_number?: string | null
  last_message_at?: string | null
  is_active?: boolean
  escalated?: boolean
  candidate?: ConversationCandidate | null
}

// The recruiter/agent behind an outbound message (e.g. Ravi, Kelly).
interface SentBy {
  id?: Id
  name?: string | null
}

// One message inside a thread — direction drives the bubble side, purpose the badge,
// sent_by/delivered_at/read_at drive the sender colour and delivery ticks (outbound only).
interface MessageRow {
  id: Id
  direction?: 'inbound' | 'outbound'
  message_content?: string | null
  sent_at?: string | null
  purpose?: string | null
  sent_by?: SentBy | null
  delivered_at?: string | null
  read_at?: string | null
}

// Humanise a purpose slug for tenants whose value has no explicit translation.
const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

// Prefer the candidate's real name over the raw WhatsApp number for the thread heading.
const candidateFullName = (row: ConversationRow) =>
  [row.candidate?.first_name, row.candidate?.last_name].filter(Boolean).join(' ').trim()

// Stable colour per sender: the candidate (inbound) gets one fixed colour; each outbound
// recruiter/agent hashes to its own tint via the shared avatar colour picker — never a
// second hash function, so a name always reads the same colour app-wide.
const senderColor = (m: MessageRow) =>
  m.direction === 'outbound' ? avatarColor(m.sent_by?.name ?? undefined) : 'var(--color-success)'

// WhatsApp-style delivery indicator for outbound messages: sent → single grey check,
// delivered → double grey check, read → double check in the primary colour. The icon
// SHAPE is the real signal (single vs. double tick) with an aria-label — colour is never
// the only cue (§6).
function DeliveryTicks({ sentAt, deliveredAt, readAt }: { sentAt?: string | null; deliveredAt?: string | null; readAt?: string | null }) {
  const { t } = useTranslation('candidates')
  if (!sentAt) return null
  const state: 'sent' | 'delivered' | 'read' = readAt ? 'read' : deliveredAt ? 'delivered' : 'sent'
  const Icon = state === 'sent' ? Check : CheckCheck
  const color = state === 'read' ? 'var(--color-primary)' : 'var(--text-muted)'
  return <Icon size={12} style={{ color, flexShrink: 0 }} role="img" aria-label={t(`conversations.delivery.${state}`)} />
}

export default function ConversationsSection({ candidateId }: { candidateId: Id }) {
  const { t } = useTranslation('candidates')
  const { formatDate, formatDateTime } = useDateFormat()
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Which thread is expanded, and its lazily-loaded messages keyed by conversation id.
  const [openId, setOpenId] = useState<Id | null>(null)
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({})
  const [msgLoading, setMsgLoading] = useState(false)

  // Load this candidate's threads; a 404/422 (filter not built) reads as empty, not broken.
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    setOpenId(null); setMessages({})
    api.get('/conversations', { params: { candidate_id: candidateId } })
      .then(r => { if (alive) setRows(unwrapList<ConversationRow>(r).rows) })
      .catch(e => { if (!alive) return; if ([404, 422].includes(e?.response?.status)) setRows([]); else setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [candidateId])

  // Auto-expand: a single thread opens immediately; with several, the first (most recent/
  // active) does. Never leaves a closed accordion the recruiter has to click through first.
  useEffect(() => {
    if (rows.length > 0) setOpenId(prev => (prev !== null ? prev : rows[0].id))
  }, [rows])

  // Flip a thread open/closed — the accordion keeps at most one thread expanded at a time.
  const toggle = useCallback((id: Id) => {
    setOpenId(prev => (prev === id ? null : id))
  }, [])

  // Fetch a thread's messages once it becomes the open one (auto-expand triggers this on mount too).
  useEffect(() => {
    if (openId === null || messages[String(openId)]) return
    let alive = true
    setMsgLoading(true)
    api.get(`/conversations/${openId}/messages`)
      .then(r => { if (alive) setMessages(m => ({ ...m, [String(openId)]: unwrapList<MessageRow>(r).rows })) })
      .catch(() => { if (alive) setMessages(m => ({ ...m, [String(openId)]: [] })) })
      .finally(() => { if (alive) setMsgLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages read only to skip a duplicate fetch, not a re-trigger
  }, [openId])

  // Active-window badge (setting `conversation_active_weeks`) — green when active, muted otherwise.
  const activeBadge = (active?: boolean) => (
    <SoftChip label={active ? t('conversations.active') : t('conversations.inactive')}
      color={active ? 'var(--color-success)' : 'var(--text-muted)'} />
  )

  return (
    // No title: the sub-tab bar already says "Conversaties" (Danny addendum 4).
    <SectionCard>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.loading')}</div>}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('conversations.error')}</div>}
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
        const heading = name || row.wa_number || t('conversations.unknownContact')
        const showNumberSub = Boolean(name) && Boolean(row.wa_number)
        return (
          <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: 'var(--bg)', overflow: 'hidden' }}>
            {/* Thread header — candidate name (number as subtext), last-activity date, active + escalated badges. */}
            <button onClick={() => toggle(row.id)} title={t('conversations.openThread')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              {isOpen ? <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <MessageCircle size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
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
              {row.escalated && (
                <SoftChip label={t('conversations.escalated')} color="var(--color-warning)" />
              )}
              {activeBadge(row.is_active)}
              {row.last_message_at && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(row.last_message_at)}</span>}
            </button>

            {/* Expanded: the thread's messages as bubbles (inbound left, outbound right). */}
            {isOpen && (
              <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {msgLoading && !messages[String(row.id)] && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.loadingMessages')}</div>
                )}
                {messages[String(row.id)] && msgs.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('conversations.noMessages')}</div>
                )}
                {msgs.map(m => {
                  const out = m.direction === 'outbound'
                  const color = senderColor(m)
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
                      {/* Outbound bubbles name the recruiter/agent behind them, colour-coded so Ravi vs Kelly reads at a glance. */}
                      {out && m.sent_by?.name && (
                        <span style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 2 }}>{m.sent_by.name}</span>
                      )}
                      <div style={{ maxWidth: '85%', padding: '6px 10px', borderRadius: 10, fontSize: 12, color: 'var(--text)',
                        background: `color-mix(in srgb, ${color} 10%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)` }}>
                        {m.message_content ?? '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {m.purpose && (
                          <SoftChip label={t(`conversations.purpose.${m.purpose}`, { defaultValue: humanize(m.purpose) })}
                            color="var(--color-primary)" />
                        )}
                        {m.sent_at && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(m.sent_at)}</span>}
                        {out && <DeliveryTicks sentAt={m.sent_at} deliveredAt={m.delivered_at} readAt={m.read_at} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Escalated-thread hint: a subtle note so the recruiter knows a human took over. */}
      {!loading && !error && rows.some(r => r.escalated) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <AlertTriangle size={12} style={{ color: 'var(--color-warning)' }} /> {t('conversations.escalatedHint')}
        </div>
      )}
    </SectionCard>
  )
}
