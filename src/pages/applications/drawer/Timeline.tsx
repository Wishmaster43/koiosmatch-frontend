/**
 * Timeline — the application drawer's Tijdlijn tab. A thin adapter: it maps the
 * mapper's items onto the shared EventTimeline (one calm row per event on a
 * continuous axis, mono time, per-day headings) and owns only the application's
 * own event vocabulary. Author is deliberately the muted meta line, not the row's
 * headline: it is null on every system event (verified live), and the old layout
 * made that missing name the boldest thing on the row.
 *
 * Loading/error are not passed: this tab renders inside a drawer that has already
 * resolved both before it mounts, so there is no honest signal to forward — the
 * states themselves live (and are tested) in EventTimeline.
 */
import type { ReactNode } from 'react'
import { ArrowRightLeft, CalendarClock, Handshake, MessageSquare, Mic, XCircle } from 'lucide-react'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import EventTimeline, { type TimelineKindMeta } from '@/components/ui/EventTimeline'
import type { Id } from '@/types/common'

export interface TimelineItem { id?: Id; initials?: string; author?: string; time?: string; description?: ReactNode; ai?: boolean }

// Event kind → its icon + semantic token. Kinds are the prefix of the backend's
// composite id (`appointment:<uuid>` / `stage:<uuid>` — verified live against
// GET /applications/{id}); the rest are the neighbouring kinds ApplicationTimeline
// can emit. Colour is spent ONLY here, where it carries the event's meaning (§4).
const KIND_META: Record<string, TimelineKindMeta> = {
  appointment: { icon: CalendarClock, color: 'var(--color-info)' },
  stage:       { icon: ArrowRightLeft, color: 'var(--color-primary)' },
  note:        { icon: MessageSquare, color: 'var(--color-secondary)' },
  interview:   { icon: Mic, color: 'var(--color-violet)' },
  match:       { icon: Handshake, color: 'var(--color-success-text)' },
  rejection:   { icon: XCircle, color: 'var(--color-danger-text)' },
}

/**
 * kindOf — the backend sends no `type` on an application timeline event, only a
 * composite id `"<kind>:<uuid>"`. A UUID never contains a colon, so the first
 * colon is a safe split. Empty for anything unprefixed → a neutral marker, never
 * a wrong icon.
 */
export function kindOf(id?: Id): string {
  const s = id == null ? '' : String(id)
  const colon = s.indexOf(':')
  return colon > 0 ? s.slice(0, colon) : ''
}

// See the file's top doc above; a thin adapter mapping application events onto the shared EventTimeline.
export default function Timeline({ items = [], emptyText }: { items?: TimelineItem[]; emptyText?: ReactNode }) {
  return (
    <EventTimeline
      emptyText={emptyText}
      kindMeta={kind => KIND_META[kind]}
      events={items.map((ev, i) => ({
        id: ev.id ?? i,
        time: ev.time,
        kind: kindOf(ev.id),
        text: ev.description,
        meta: ev.author || null,
        trailing: ev.ai ? <AiGeneratedLabel size={10} /> : null,
      }))}
    />
  )
}
