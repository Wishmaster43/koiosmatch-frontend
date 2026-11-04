/**
 * TranscriptBubble — INTERVIEWS-SPLIT-1: one interview transcript bubble,
 * extracted verbatim from InterviewsTab.tsx (size split, no behaviour change).
 */
import { useDateFormat } from '@/lib/datetime'
import { tintBg, tintBorder } from '@/lib/tint'
import type { ApplicationDetail } from '@/types/application'

type TranscriptMsg = ApplicationDetail['interviews'][number]['transcript'][number]

// W7: one transcript bubble, aligned by `direction` (outbound = us, right; inbound =
// candidate, left) — mirrors ConversationsSection's WhatsApp bubble convention. The real
// contract carries no author identity (data minimisation §9), so direction is the only
// signal; sent_at renders via the shared useDateFormat, never a raw ISO string.
export default function TranscriptBubble({ msg }: { msg: TranscriptMsg }) {
  const { formatDateTime } = useDateFormat()
  const isOut = msg.direction === 'outbound'
  const color = isOut ? 'var(--color-primary)' : 'var(--color-success)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start', gap: 3 }}>
      {/* Canon (05-08): body text 12px, matching the candidate profile/notes prose convention.
          Bubble fill via the lib/tint house pair (neutral ink — a bubble, not a chip). */}
      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 12, color: 'var(--text)', lineHeight: 1.45,
        background: tintBg(color),
        border: tintBorder(color) }}>
        {msg.body || '—'}
      </div>
      {msg.sentAt && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(msg.sentAt)}</span>}
    </div>
  )
}
