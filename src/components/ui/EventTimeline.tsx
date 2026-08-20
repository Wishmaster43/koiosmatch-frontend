import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, History } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import TimelineRail from './TimelineRail'
import { GroupLabel, Caption } from './typography'
import { useDateFormat } from '@/lib/datetime'

/** Icon + semantic token for one event kind — the ONLY place colour is spent here (§4). */
export interface TimelineKindMeta { icon?: LucideIcon; color?: string }

/** One rendered event. `text` is what happened; `meta` is the muted who/context line. */
export interface TimelineEvent {
  id?: string | number
  // ISO timestamp — grouped into days and rendered as HH:mm in mono.
  time?: string
  // Event kind, resolved to an icon + colour by the caller's `kindMeta`.
  kind?: string
  text?: ReactNode
  meta?: ReactNode
  // Right-aligned addendum on the primary line (e.g. the AI-generated label).
  trailing?: ReactNode
  // NOTES-TIMELINE-CONVERGE-1: makes the marker itself a button (e.g. NotesTab's
  // "open changelog" affordance on a status-change row) — omitted (every other
  // event) keeps the marker an inert dot. `markerLabel` is its required aria-label.
  onMarkerClick?: () => void
  markerLabel?: string
}

interface EventTimelineProps {
  events: TimelineEvent[]
  // Kind → icon/colour. Omitted or unresolved kinds fall back to a neutral dot.
  kindMeta?: (kind: string) => TimelineKindMeta | undefined
  loading?: boolean
  error?: boolean
  // All four state texts come from the caller's own namespace — this component
  // owns no entity vocabulary, only the day headings it formats itself.
  loadingText?: ReactNode
  errorText?: ReactNode
  emptyText?: ReactNode
}

// Times sit in their own right-aligned mono column: that column IS the second
// vertical guide next to the axis, and tabular figures keep the digits aligned (§4).
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- fixed-width mono time COLUMN (tabular-nums, right-aligned) beside the timeline axis, not a Caption/label copy
const timeStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-muted)', width: 38, flexShrink: 0, textAlign: 'right', paddingTop: 3,
}

/**
 * EventTimeline — THE shared chronological activity list (Danny punt 17: "tijdlijn
 * ziet er nog niet uit"). One calm row per event: a soft-tinted marker on a
 * continuous vertical axis, the time in mono, the event text at full contrast and
 * the author demoted to a muted meta line. Events are grouped per day under a
 * heading that reuses the shared `GroupLabel` atom, so the date is stated
 * once instead of repeated on every row.
 *
 * Presentational only (§2: components/ui is dumb) — no fetching, no business logic.
 * All four states (loading/error/empty/success) are rendered here and mirror the
 * candidate ChangelogTab exactly, so the two surfaces read as one app.
 */
export default function EventTimeline({
  events, kindMeta, loading = false, error = false, loadingText, errorText, emptyText,
}: EventTimelineProps) {
  const { t } = useTranslation('common')
  const { formatDate, formatTime, formatDateTime } = useDateFormat()

  // Group CONSECUTIVE events into calendar days: the backend already sends the
  // timeline newest-first (verified live), so grouping consecutively preserves the
  // caller's order instead of silently re-sorting its list. Undated events form
  // their own heading-less group rather than being dropped.
  const groups = useMemo(() => {
    const out: Array<{ key: string; day: Date | null; items: Array<{ ev: TimelineEvent; index: number }> }> = []
    events.forEach((ev, index) => {
      const d = ev.time ? new Date(ev.time) : null
      const valid = d && !isNaN(d.getTime()) ? d : null
      const key = valid ? `${valid.getFullYear()}-${valid.getMonth()}-${valid.getDate()}` : ''
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push({ ev, index })
      else out.push({ key, day: valid, items: [{ ev, index }] })
    })
    return out
  }, [events])

  // "Vandaag" / "Gisteren" for the two most recent days, the plain long date beyond
  // that — the calm heading, never a full timestamp repeated per row.
  const dayLabel = (day: Date | null): string => {
    if (!day) return ''
    const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const diffDays = Math.round((midnight(new Date()) - midnight(day)) / 86400000)
    if (diffDays === 0) return t('timeline.today')
    if (diffDays === 1) return t('timeline.yesterday')
    return formatDate(day.toISOString(), { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loadingText}</div>

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
        <AlertTriangle size={14} /> {errorText}
      </div>
    )
  }

  if (!events.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
        <History size={22} style={{ opacity: 0.5 }} />
        <span style={{ fontSize: 12 }}>{emptyText}</span>
      </div>
    )
  }

  const lastIndex = events.length - 1

  return (
    // No gap between rows: each row's own paddingBottom carries the spacing so the
    // axis stays unbroken from one marker down to the next.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {groups.map((g, gi) => (
        <Fragment key={`${g.key}-${gi}`}>
          {/* Day heading beside the axis; above the FIRST one the line is omitted
              so the axis starts at the first marker instead of dangling. */}
          {g.day && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: gi === 0 ? 0 : 10, paddingBottom: 8 }}>
              <TimelineRail variant={gi === 0 ? 'spacer' : 'connector'} />
              <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{dayLabel(g.day)}</GroupLabel>
            </div>
          )}
          {g.items.map(({ ev, index }) => {
            const meta = ev.kind && kindMeta ? kindMeta(ev.kind) : undefined
            return (
              <div key={ev.id ?? index} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                <TimelineRail isLast={index === lastIndex} icon={meta?.icon} color={meta?.color ?? 'var(--text-muted)'}
                  onClick={ev.onMarkerClick} ariaLabel={ev.markerLabel} />
                {/* title = the full date+time, so the exact moment stays available
                    on hover without shouting it on every row. */}
                <span style={timeStyle} title={formatDateTime(ev.time)}>{formatTime(ev.time) || '—'}</span>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 400, lineHeight: 1.45, color: 'var(--text)' }}>{ev.text}</span>
                    {ev.trailing}
                  </div>
                  {ev.meta && <Caption as="div" style={{ marginTop: 2 }}>{ev.meta}</Caption>}
                </div>
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
