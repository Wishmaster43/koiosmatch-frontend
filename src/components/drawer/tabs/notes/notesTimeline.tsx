/**
 * notesTimeline — the merged timeline builder + the standalone system-event row
 * renderer, both pulled out of NotesTab.tsx (§3 hard cap — split trigger hit at
 * 708 lines). Two related but distinct pieces live here:
 * (1) `useMergedTimelineEvents` — NOTES-TIMELINE-CONVERGE-1 (14-08): system
 *     events (status/phase changes) and the host's own timeline items, merged
 *     into ONE chronological list for the shared EventTimeline.
 * (2) `renderSystemRow` — the calm one-line system-event row used as a fallback
 *     when a stray system note shows up inside the regular notes list (never in
 *     the composer, never editable beyond the optional status-edit pencil).
 * Both key off the SAME `isSystemNote`/note-shape rules as the rest of the tab.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Edit2, History } from 'lucide-react'
import type { TimelineEvent as TimelineEventInput } from '@/components/ui/EventTimeline'
import SafeHtml from '@/components/ui/SafeHtml'
import { Caption } from '@/components/ui/typography'
import { NoteTypeChip } from './NoteChips'
import type { NoteItem, NoteType, NotesLabels } from '../NotesTab'

interface TimelineItem { time?: string; created_at?: string; text?: string; description?: string; [k: string]: unknown }

interface MergedTimelineOptions {
  systemNotes: NoteItem[]
  timeline: TimelineItem[]
  chipTypes?: NoteType[]
  noteTypes: NoteType[]
  onEditStatusEvent?: () => void
  editStatusEventLabel?: string
  openChangelogLabel?: NotesLabels['openChangelog']
  timelineName?: ReactNode
  renderTimelineContent?: (ev: TimelineItem) => ReactNode | null
  noteAuthor: (n: NoteItem) => string
}

// NOTES-TIMELINE-CONVERGE-1: system events + the host's own timeline items,
// merged into ONE chronological list for the shared EventTimeline. Sort is
// stable, so items sharing a timestamp (or carrying none) keep their incoming
// relative order.
export function useMergedTimelineEvents({
  systemNotes, timeline, chipTypes, noteTypes, onEditStatusEvent, editStatusEventLabel, openChangelogLabel,
  timelineName, renderTimelineContent, noteAuthor,
}: MergedTimelineOptions) {
  return useMemo(() => {
    const sysEvents: TimelineEventInput[] = systemNotes.map((n, i) => {
      const canEditStatus = Boolean(onEditStatusEvent) && n.type === 'status_change'
      return {
        id: `sys-${n.id ?? i}`,
        time: n.created_at,
        kind: 'system',
        text: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {n.type && <NoteTypeChip value={n.type} types={chipTypes ?? noteTypes} />}
            <SafeHtml html={n.text ?? n.body ?? ''} />
          </span>
        ),
        meta: noteAuthor(n) || undefined,
        trailing: canEditStatus
          ? <button onClick={onEditStatusEvent} title={editStatusEventLabel} aria-label={editStatusEventLabel}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline icon cluster in the note row (13px icons, 6px step): Button's 28px box would widen every row; identity stays muted ink on none
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}>
              <Edit2 size={13} />
            </button>
          : null,
        onMarkerClick: () => window.dispatchEvent(new CustomEvent('km:open-changelog')),
        markerLabel: typeof openChangelogLabel === 'string' ? openChangelogLabel : undefined,
      }
    })
    const hostEvents: TimelineEventInput[] = timeline.map((ev, i) => ({
      id: `ev-${i}`,
      time: ev.time ?? ev.created_at,
      meta: timelineName,
      text: renderTimelineContent?.(ev) ?? (ev.text ?? ev.description),
    }))
    return [...sysEvents, ...hostEvents]
      .sort((a, b) => (Date.parse(String(b.time ?? '')) || 0) - (Date.parse(String(a.time ?? '')) || 0))
  }, [systemNotes, timeline, chipTypes, noteTypes, onEditStatusEvent, editStatusEventLabel, openChangelogLabel, timelineName, renderTimelineContent, noteAuthor])
}

interface SystemRowOptions {
  labels: NotesLabels
  chipTypes?: NoteType[]
  noteTypes: NoteType[]
  onEditStatusEvent?: () => void
  noteAuthor: (n: NoteItem) => string
  noteWhen: (n: NoteItem) => string | undefined
}

// Calm one-line system-event row (status/phase change): History icon, chip, no
// pencil by default. The icon is a BUTTON that opens the record changelog
// (Danny 13/7) — decoupled via a window event so this shared tab needs no
// drawer-specific wiring.
export function renderSystemRow(n: NoteItem, key: string | number, { labels, chipTypes, noteTypes, onEditStatusEvent, noteAuthor, noteWhen }: SystemRowOptions) {
  const who = noteAuthor(n)
  // Only the "Statuswissel" event (n.type === 'status_change') is editable in place —
  // never a 'lifecycle' event (archived/restored) — and only when the host actually
  // passed the callback (see onEditStatusEvent on the props for why).
  const canEditStatus = Boolean(onEditStatusEvent) && n.type === 'status_change'
  return (
    <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
      <button onClick={() => window.dispatchEvent(new CustomEvent('km:open-changelog'))}
        title={labels.openChangelog} aria-label={labels.openChangelog}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- 26px ROUND timeline marker-button: Button's 28px r6 geometry breaks the circular marker; identity stays on hover-bg/muted tokens
        style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hover-bg)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
        <History size={13} />
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
        {n.type && <NoteTypeChip value={n.type} types={chipTypes ?? noteTypes} />}
        <SafeHtml style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }} html={n.text ?? n.body ?? ''} />
        <Caption as="span" style={{ whiteSpace: 'nowrap' }}>{who ? `${who} · ` : ''}{noteWhen(n)}</Caption>
      </div>
      {canEditStatus && (
        <button onClick={onEditStatusEvent} title={labels.editStatusEvent} aria-label={labels.editStatusEvent}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact inline icon cluster in the note row (13px icons, 6px step): Button's 28px box would widen every row; identity stays muted ink on none
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}>
          <Edit2 size={13} />
        </button>
      )}
    </div>
  )
}
