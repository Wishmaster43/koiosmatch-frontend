/**
 * useCandidateStatistics — STATS-HONEST-1 (B11, point 19): every number on the
 * Statistics tab is DERIVED from data the drawer already holds (or a cheap extra
 * fetch), never invented. Each block below is only meaningful when its source
 * array/field is actually present — the tab hides a block rather than showing a
 * fabricated zero for data that was never loaded (frozen-drilldown discipline:
 * this only fills the existing empty tab, it changes nothing else).
 */
import { useMemo } from 'react'
import type { Candidate } from '@/types/candidate'
import type { AppRow, Appt } from '@/pages/candidates/drawer/applicationRowModel'
import type { CandidateNote } from '@/pages/candidates/hooks/useCandidateNotes'

// One funnel-stage bucket with its live count — grouped by the row's own stable
// key (stageKey, falling back to the translated label) so a tenant renaming a
// stage never silently splits its count into two rows.
export interface OutcomeBucket { key: string; label: string; color: string | null; count: number }

// Appointment counts by lifecycle bucket — 'upcoming' = scheduled in the future
// and not cancelled/done; 'completed' = anything else that isn't cancelled.
export interface AppointmentStats { total: number; upcoming: number; completed: number }

export interface CandidateStatistics {
  applicationsTotal: number
  matchesTotal: number
  applicationsByOutcome: OutcomeBucket[]
  appointments: AppointmentStats | null
  notesCount: number | null
  lastContactAt: string | null
  lastContactType: string | null
  daysSinceCreated: number | null
  daysSincePhaseChange: number | null
}

// Whole days between an ISO/date-ish value and `now` — null for a missing,
// unparseable, or future value (a stamp in the future is not "days since").
function daysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / 86400000)
}

// Groups the candidate's applications by funnel stage, counting each bucket —
// the honest replacement for a hardcoded "hired/rejected" vocabulary, since
// funnel stages are a tenant-configured lookup (§3B), never a fixed set here.
function groupByOutcome(apps: AppRow[]): OutcomeBucket[] {
  const buckets = new Map<string, OutcomeBucket>()
  for (const app of apps) {
    const key = app.stageKey ?? app.stageLabel
    if (!key) continue
    const existing = buckets.get(key)
    if (existing) existing.count += 1
    else buckets.set(key, { key, label: app.stageLabel ?? key, color: app.stageColor ?? null, count: 1 })
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count)
}

// An appointment counts as 'upcoming' when scheduled in the future and not
// cancelled; anything else with a status that isn't cancelled counts 'completed'.
function summarizeAppointments(appts: Appt[], now: Date): AppointmentStats {
  let upcoming = 0
  let completed = 0
  for (const a of appts) {
    const status = (a.status ?? '').toLowerCase()
    if (status === 'cancelled' || status === 'canceled') continue
    const scheduled = a.scheduled_at ? new Date(a.scheduled_at) : null
    const isFuture = scheduled && !isNaN(scheduled.getTime()) && scheduled.getTime() > now.getTime()
    if (isFuture) upcoming += 1
    else completed += 1
  }
  return { total: upcoming + completed, upcoming, completed }
}

/**
 * Computes every Statistics-tab number from the candidate record plus the two
 * cheap side-loads (notes, appointments) the tab fetches. `now` is injectable
 * so day-counts are deterministically testable.
 */
export function computeCandidateStatistics(
  c: Candidate,
  notes: CandidateNote[] | null,
  appointments: Appt[] | null,
  now: Date = new Date()
): CandidateStatistics {
  const apps = (c.applications ?? []) as unknown as AppRow[]
  return {
    applicationsTotal: apps.length,
    matchesTotal: (c.matches ?? []).length,
    applicationsByOutcome: groupByOutcome(apps),
    appointments: appointments && appointments.length > 0 ? summarizeAppointments(appointments, now) : null,
    notesCount: notes ? notes.length : null,
    lastContactAt: c.lastContactAt ?? null,
    lastContactType: c.lastContactType ?? null,
    daysSinceCreated: daysSince(c.created, now),
    daysSincePhaseChange: daysSince(c.statusChangedAt, now),
  }
}

// Memoized hook wrapper for component use — recomputes only when its inputs change.
export function useCandidateStatistics(
  c: Candidate,
  notes: CandidateNote[] | null,
  appointments: Appt[] | null
): CandidateStatistics {
  return useMemo(() => computeCandidateStatistics(c, notes, appointments), [c, notes, appointments])
}
