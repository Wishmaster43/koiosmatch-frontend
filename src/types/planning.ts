/**
 * Planning (shift calendar) types. `Shift` is the flat row shape every calendar
 * view (month/week/day/list) renders — PlanningPage now fills it from the real
 * GET /planning/board endpoint (see pages/planning/hooks/usePlanningBoard, which
 * owns the raw API shape) instead of local demo data. `id` stays `string |
 * number`: real shifts carry a uuid, while the still-gated local add path
 * (AddShiftModal's Save is disabled — no order-creation flow exists yet) keeps
 * minting a numeric id for its in-memory-only row.
 */

// One planned shift on the calendar.
export interface Shift {
  id: string | number
  date: Date
  title: string
  location: string
  candidate: string
  start: string
  end: string
  color: string
  // Real-only extras (undefined for the local add-modal's in-memory row):
  // still-open headcount + status, so a view can flag an understaffed shift
  // without pretending it knows something the flat legacy fields don't carry.
  openSpots?: number
  numberPersons?: number
}

// A new shift before it gets an id (what the add-modal emits).
export type ShiftInput = Omit<Shift, 'id'>
