/**
 * usePlanningBoard — real data for the planning calendar (PLANNING-PERSIST-1
 * follow-up, read side). Wraps GET /planning/board, the endpoint the backend
 * survey confirmed exists today (PlanningBoardController → PlanningBoardBuilder):
 * one query, grouped day-first-then-customer, each shift carrying who is
 * scheduled on it (`assigned[]`) and how many spots are still open. This hook
 * flattens that grid into a flat row list the existing month/week/day/list
 * views already know how to render (they only ever filter a flat array by day).
 *
 * The create/add side of this screen is a SEPARATE, still-gated concern
 * (AddShiftModal's Save stays disabled — no order-creation flow exists yet, see
 * its own file header) — this hook only covers what the survey confirmed is
 * real and readable: viewing the tenant's actual scheduled shifts.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// One assigned candidate row, exactly the fields the board resource returns —
// never invented (no favourite/distance/etc — that ranking lives only in the
// shift-candidates suggestion endpoint, a different concern).
export interface PlanningBoardAssignee {
  scheduleId: string
  candidateId: string | null
  candidate: string | null
  status: string | null
}

// One shift row, flattened out of board.days[].groups[].shifts[] with its
// group's customer/location attached — the exact fields PlanningBoardBuilder
// emits, no client-side invention of a shape the backend doesn't send.
export interface PlanningBoardShift {
  id: string
  planningOrderId: string | null
  function: string | null
  shiftType: string | null
  startTime: string | null
  endTime: string | null
  status: string | null
  numberPersons: number
  scheduledCount: number
  openSpots: number
  openShift: boolean
  assigned: PlanningBoardAssignee[]
  customerId: string | null
  customer: string | null
  customerLocationId: string | null
  location: string | null
}

interface RawAssignee { schedule_id: string; candidate_id: string | null; candidate: string | null; status: string | null }
interface RawShift {
  id: string; planning_order_id: string | null; function: string | null; shift_type: string | null
  start_time: string | null; end_time: string | null; status: string | null
  number_persons: number; scheduled_count: number; open_spots: number; open_shift: boolean
  assigned: RawAssignee[]
}
interface RawGroup { customer_id: string | null; customer: string | null; customer_location_id: string | null; location: string | null; shifts: RawShift[] }
interface RawDay { date: string; groups: RawGroup[] }
interface RawBoard { from: string; to: string; days: RawDay[]; meta: { total_shifts: number; open_shifts: number } }

// Flattens the day/group grid into one row list, attaching each group's
// customer/location onto its own shifts.
function flatten(board: RawBoard): PlanningBoardShift[] {
  const rows: PlanningBoardShift[] = []
  for (const day of board.days ?? []) {
    for (const group of day.groups ?? []) {
      for (const shift of group.shifts ?? []) {
        rows.push({
          id: shift.id,
          planningOrderId: shift.planning_order_id ?? null,
          function: shift.function ?? null,
          shiftType: shift.shift_type ?? null,
          startTime: shift.start_time ?? null,
          endTime: shift.end_time ?? null,
          status: shift.status ?? null,
          numberPersons: shift.number_persons ?? 0,
          scheduledCount: shift.scheduled_count ?? 0,
          openSpots: shift.open_spots ?? 0,
          openShift: !!shift.open_shift,
          assigned: (shift.assigned ?? []).map(a => ({
            scheduleId: a.schedule_id, candidateId: a.candidate_id ?? null,
            candidate: a.candidate ?? null, status: a.status ?? null,
          })),
          customerId: group.customer_id ?? null,
          customer: group.customer ?? null,
          customerLocationId: group.customer_location_id ?? null,
          location: group.location ?? null,
        })
      }
    }
  }
  return rows
}

// Stable empty array — a hook returning a fresh [] on every render feeds a
// changing reference into memoized callers and can loop them (house rule).
const EMPTY_SHIFTS: PlanningBoardShift[] = []

// `from`/`to` as 'YYYY-MM-DD' — the window this screen's active view covers
// (the whole visible calendar grid, not just the strict month/week days), so
// switching month/week/day/list never needs a second round trip.
export function usePlanningBoard(from: string, to: string) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['planning', 'board', from, to],
    queryFn: async ({ signal }) => {
      const res = await api.get('/planning/board', { params: { from, to }, signal })
      return flatten(unwrap<RawBoard>(res))
    },
    enabled: !!from && !!to,
  })
  return { shifts: data ?? EMPTY_SHIFTS, loading: isLoading, error: isError, refetch }
}
