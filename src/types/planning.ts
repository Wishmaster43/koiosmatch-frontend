/**
 * Planning (shift calendar) types. The calendar shifts list is still demo-data
 * driven (PlanningPage's INITIAL_SHIFTS — out of PLAN-LOOKUP-1's scope); the
 * add-shift modal's own pickers are real (see pages/planning/hooks/useShiftLookups,
 * which owns the ShiftCandidateOption shape for the candidate search).
 */

// One planned shift on the calendar.
export interface Shift {
  id: number
  date: Date
  title: string
  location: string
  candidate: string
  start: string
  end: string
  color: string
}

// A new shift before it gets an id (what the add-modal emits).
export type ShiftInput = Omit<Shift, 'id'>
