/**
 * usePlanningShifts — the real POST /planning/shifts create path
 * (PLANNING-PERSIST-1-staart). Verified against PlanningShiftController::validated
 * (koiosmatch-api, read-only): `planning_order_id` + `start_time` are required,
 * everything else (customer_department_id, function, end_time, number_persons,
 * notes, …) is optional and nullable. AddShiftModal builds this exact body and
 * calls the mutation on Save instead of only ever handing the shift to the
 * page's local, in-memory `onAdd` sink.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

// The exact body PlanningShiftController::validated() accepts on create.
export interface PlanningShiftInput {
  planning_order_id: Id
  customer_location_id?: string | null
  customer_department_id?: string | null
  function?: string | null
  start_time: string
  end_time?: string | null
  number_persons?: number
  notes?: string | null
}

// One created shift row, exactly the fields PlanningShiftResource returns.
export interface PlanningShiftRow {
  id: string
  planning_order_id: string
  function: string | null
  start_time: string | null
  end_time: string | null
  number_persons: number
  status: string
  notes: string | null
}

/** POST /planning/shifts — creates the shift, then invalidates the board so the
 * calendar shows it without a manual refresh (the board's query key carries a
 * dynamic from/to window, so invalidation matches on the shared ['planning',
 * 'board'] prefix rather than one exact key). */
export function useCreatePlanningShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: PlanningShiftInput) => unwrap<PlanningShiftRow>(await api.post('/planning/shifts', body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planning', 'board'] }),
  })
}
