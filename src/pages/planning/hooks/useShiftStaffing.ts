/**
 * useShiftStaffing — the real staffing actions for one shift (SHIFT-STAFF-1):
 * eligible-candidate list, assign, un-assign, cancel-with-reason and checkout.
 * Every call hits the routes verified live against the backend today
 * (routes/api/tenant/pools.php + PlanningShiftController/PlanningScheduleController):
 *   GET  /planning/shifts/{shift}/candidates   — ranked, eligible pool + reason
 *   POST /planning/shifts/{shift}/assignments  — candidate_id (+status/notes) → 201
 *   DELETE /planning/schedules/{id}            — un-schedule (soft delete)
 *   PATCH /planning/schedules/{id}/cancel      — status + cancellation_reason (lookup slug)
 *   PATCH /planning/schedules/{id}/checkout    — actual_start/end/break; server computes hours
 * Nothing here invents a favourite/reason/hours figure — every field rendered by the
 * caller is exactly what these responses carry.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useCachedLookup } from '@/lib/useCachedLookup'
import type { AxiosResponse } from 'axios'
import type { LookupOption } from '@/types/common'

// ── Eligible candidates for one shift (GET /planning/shifts/{shift}/candidates) ──
export interface EligibleCandidate {
  id: string
  firstName: string
  lastName: string
  favourite: boolean
  reason: string
}
interface RawEligible { id: string; first_name: string; last_name: string; favourite: boolean; reason: string }

// Fetches the ranked, eligible candidate pool for one shift (see file docblock
// above); disabled entirely with no shift selected.
export function useShiftEligibleCandidates(shiftId: string | null) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['planning', 'shift-candidates', shiftId],
    queryFn: async ({ signal }) => {
      const res = await api.get(`/planning/shifts/${shiftId}/candidates`, { signal })
      const rows = unwrap<{ data: RawEligible[] }>(res).data ?? []
      return rows.map(r => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, favourite: !!r.favourite, reason: r.reason })) as EligibleCandidate[]
    },
    enabled: !!shiftId,
  })
  return { candidates: data ?? [], loading: isLoading, error: isError, refetch }
}

// ── Cancellation reasons — tenant lookup (GET /planning-cancellation-reasons), never
// a hardcoded list. SlugLookupController shape: value/label/color/order/in_use.
interface RawReason { value?: string; label?: string; name?: string; color?: string }
const mapReasons = (res: AxiosResponse): LookupOption[] | null => {
  const rows = unwrapList<RawReason>(res).rows
  const mapped = rows.map(r => ({ value: String(r.value ?? ''), label: String(r.label ?? r.name ?? r.value ?? ''), color: r.color }))
  return mapped.length ? mapped : null
}
// Cached tenant lookup for cancellation reasons, never a hardcoded list.
export function usePlanningCancellationReasons() {
  const { data, loading } = useCachedLookup('/planning-cancellation-reasons', mapReasons, [] as LookupOption[])
  return { reasons: data, loading }
}

// One PlanningSchedule row as the resource returns it — used to read back
// server-computed actual_total_hours after checkout, never client-computed.
export interface PlanningScheduleRow {
  id: string
  status: string | null
  actualStartTime: string | null
  actualEndTime: string | null
  actualBreakMinutes: number | null
  actualTotalHours: number | null
  cancellationReason: string | null
}
interface RawSchedule {
  id: string; status: string | null
  actual_start_time: string | null; actual_end_time: string | null
  actual_break_minutes: number | null; actual_total_hours: number | null
  cancellation_reason: string | null
}
const mapSchedule = (r: RawSchedule): PlanningScheduleRow => ({
  id: r.id, status: r.status,
  actualStartTime: r.actual_start_time, actualEndTime: r.actual_end_time,
  actualBreakMinutes: r.actual_break_minutes, actualTotalHours: r.actual_total_hours,
  cancellationReason: r.cancellation_reason,
})

// ── Mutations. Every one invalidates the board query (assigned/open counts live
// there) plus this shift's own eligible-candidate list (a newly-assigned or freed
// candidate must drop out of / back into the pool without a manual refresh). ──
export function useShiftStaffingMutations(shiftId: string | null) {
  const qc = useQueryClient()
  // Refreshes the board (assigned/open counts) and this shift's own eligible-candidate
  // list after any staffing mutation, so a newly assigned/freed candidate moves without
  // a manual reload.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['planning', 'board'] })
    qc.invalidateQueries({ queryKey: ['planning', 'shift-candidates', shiftId] })
  }

  // Assign — POST /planning/shifts/{shift}/assignments. 409 = already on this
  // shift, 422 = the double-booking/availability/blacklist guard (names the
  // clashing shift in its message) — both left for the caller to read via
  // extractApiError, never swallowed or generalised here.
  const assign = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await api.post(`/planning/shifts/${shiftId}/assignments`, { candidate_id: candidateId })
      return mapSchedule(unwrap<RawSchedule>(res))
    },
    onSuccess: invalidate,
  })

  // Un-assign — DELETE /planning/schedules/{id} (soft delete, frees the spot).
  const unassign = useMutation({
    mutationFn: async (scheduleId: string) => { await api.delete(`/planning/schedules/${scheduleId}`) },
    onSuccess: invalidate,
  })

  // Cancel with a reason — PATCH /planning/schedules/{id}/cancel. status is
  // 'cancelled' | 'no_show'; cancellation_reason must be a lookup value (server
  // enforces `exists:planning_cancellation_reasons,value`).
  const cancel = useMutation({
    mutationFn: async (vars: { scheduleId: string; status: 'cancelled' | 'no_show'; reason: string; notes?: string }) => {
      const res = await api.patch(`/planning/schedules/${vars.scheduleId}/cancel`, {
        status: vars.status, cancellation_reason: vars.reason, notes: vars.notes,
      })
      return mapSchedule(unwrap<RawSchedule>(res))
    },
    onSuccess: invalidate,
  })

  // Checkout — PATCH /planning/schedules/{id}/checkout. Never send a computed
  // hours figure: the response's actual_total_hours is server-computed and is
  // the only value ever rendered back to the caller.
  const checkout = useMutation({
    mutationFn: async (vars: { scheduleId: string; actualStart: string; actualEnd: string; actualBreakMinutes?: number; notes?: string }) => {
      const res = await api.patch(`/planning/schedules/${vars.scheduleId}/checkout`, {
        actual_start_time: vars.actualStart, actual_end_time: vars.actualEnd,
        actual_break_minutes: vars.actualBreakMinutes, notes: vars.notes,
      })
      return mapSchedule(unwrap<RawSchedule>(res))
    },
    onSuccess: invalidate,
  })

  return { assign, unassign, cancel, checkout }
}
