/**
 * graceWindow (ONIX S-004) — the ONE deletion-grace date computation, kept pure
 * and import-light so presentational components can use it without the hook tree.
 */
import { windowBoundaryAfter, windowDays, type WindowUnit } from '@/lib/windowUnit'

// Tenant grace window as amount + unit (days/workdays/weeks/months).
export interface GraceWindow { amount: number; unit: WindowUnit }

// BE floor on the grace period, in days.
const GRACE_FLOOR_DAYS = 7

// The ONE grace-date computation (ONIX S-004): mirrors the BE DeletionGraceDaysPolicy,
// which converts (amount, unit) to days through WindowUnit FIRST and only THEN floors
// the resulting days at 7 — the floor is never applied to the raw amount.
export function graceBoundary(from: Date, window: GraceWindow | number): Date {
  const w: GraceWindow = typeof window === 'number' ? { amount: window, unit: 'days' } : window
  const boundary = windowBoundaryAfter(from, w.amount, w.unit)
  return windowDays(from, boundary, w.unit) < GRACE_FLOOR_DAYS ? windowBoundaryAfter(from, GRACE_FLOOR_DAYS, 'days') : boundary
}

// Whole days from `from` to the floored grace boundary, for consumers that only need a count.
export function graceWindowDays(from: Date, window: GraceWindow): number {
  return windowDays(from, graceBoundary(from, window), 'days')
}
