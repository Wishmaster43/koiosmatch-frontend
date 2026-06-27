/**
 * Planning (shift calendar) types. The calendar is demo-data driven for now;
 * these shapes type the shift rows and the candidate suggestions.
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

// A candidate suggestion shown in the add-shift modal.
export interface Suggestie {
  name: string
  initials: string
  functie: string
  uren: number
  km: string
  color: string
  favoriet: boolean
}
