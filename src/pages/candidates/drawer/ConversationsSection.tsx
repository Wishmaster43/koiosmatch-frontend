/**
 * ConversationsSection — the candidate's WhatsApp conversations in the
 * Communicatie → Conversaties sub-tab (CONV-DRILLDOWN-FE). Replaces the old
 * hardcoded-empty placeholder that never called the endpoint: it fetches the
 * real threads for this candidate and lets you expand one to read its messages.
 *
 * Data: GET /conversations?candidate_id={id} (native-first candidate relation,
 * setting-driven `is_active`), then GET /conversations/{id}/messages on expand.
 * Health-adjacent PII (§8): nothing is logged; we only render what the screen needs.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

// One conversation thread as GET /conversations returns it (only the fields the panel shows).
interface ConversationRow {
  id: Id
  wa_number?: string | null
  last_message_at?: string | null
  is_active?: boolean
  escalated?: boolean
}

// One message inside a thread — direction drives the bubble side, purpose the badge.
interface MessageRow {
  id: Id
  direction?: 'inbound' | 'outbound'
  message_content?: string | null
  sent_at?: string | null
  purpose?: string | null
}

// Humanise a purpose slug for tenants whose value has no explicit translation.
const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

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
    api.get('/conversations', { params: { candidate_id: candidateId } })
      .then(r => { if (alive) setRows(unwrapList<ConversationRow>(r).rows) })
      .catch(e => { if (!alive) return; if ([404, 422].includes(e?.response?.status)) setRows([]); else setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [candidateId])

  // Expand a thread → fetch its messages once (oldest first), then toggle open/closed.
  const toggle = useCallback((id: Id) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (messages[String(id)]) return
    setMsgLoading(true)
    api.get(`/conversations/${id}/messages`)
      .then(r => setMessages(m => ({ ...m, [String(id)]: unwrapList<MessageRow>(r).rows })))
      .catch(() => setMessages(m => ({ ...m, [String(id)]: [] })))
      .finally(() => setMsgLoading(false))
  }, [openId, messages])

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
        return (
          <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: 'var(--bg)', overflow: 'hidden' }}>
            {/* Thread header — number, last-activity date, active + escalated badges. */}
            <button onClick={() => toggle(row.id)} title={t('conversations.openThread')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              {isOpen ? <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <MessageCircle size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.wa_number ?? '—'}
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
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '85%', padding: '6px 10px', borderRadius: 10, fontSize: 12, color: 'var(--text)',
                        background: out ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'var(--surface)',
                        border: '1px solid var(--border)' }}>
                        {m.message_content ?? '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {m.purpose && (
                          <SoftChip label={t(`conversations.purpose.${m.purpose}`, { defaultValue: humanize(m.purpose) })}
                            color="var(--color-primary)" />
                        )}
                        {m.sent_at && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(m.sent_at)}</span>}
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
