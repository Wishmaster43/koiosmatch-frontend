/**
 * Shared shapes for the candidate planning sub-tabs. The planning data is still
 * dummy/mock-driven, but these types keep PlanningPanel and its sub-tabs in sync
 * (one source for the favourite/blacklist lists, filters and shift rows).
 */
import type { Id } from '@/types/common'

// Favourite / do-not-schedule lists, grouped by entity kind.
export interface FavLists { clients: string[]; locations: string[]; departments: string[] }

// Open-shift filter bar state.
export interface OpenFilters { shiftTypes: string[]; distance: number; max_level: number }

// An open shift offered to the candidate.
export interface OpenShift {
  id: Id; date: string; time: string; client: string; function: string
  location: string; color: string; distance: number; level: number
  shiftType: string; openSpots: number; pool: string
}

// A scheduled roster row (base shift or one picked from open shifts).
export interface RosterShift {
  date: string; time: string; client: string; function?: string
  location: string; color: string; workedBefore: number; favorite: boolean
  address?: string; remarks?: string; _openId?: Id
}

// Per-shift favourite overrides, keyed by date+client.
export type ScheduleFavorites = Record<string, boolean>
