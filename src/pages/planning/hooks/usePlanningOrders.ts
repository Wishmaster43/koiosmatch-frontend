/**
 * usePlanningOrders — the real Planning Orders API (PLANNING-ORDER-CREATE-1).
 *
 * Verified against koiosmatch-api's PlanningOrderController + routes/api/tenant/pools.php
 * (2026-08-14, live read against the controller and FormRequest validation rules, not
 * the generated OpenAPI spec — that file only documents request shapes for routes it
 * covers, and the 2xx response shape for this one wasn't in it):
 *   GET    /planning/orders            -> paginated PlanningOrderResource[]
 *   POST   /planning/orders            -> 201 + PlanningOrderResource
 *   PATCH  /planning/orders/{order}    -> 200 + PlanningOrderResource
 *   DELETE /planning/orders/{order}    -> 204, or 409 while it still has non-cancelled
 *          shifts (PlanningOrderController::destroy aborts with a real reason string)
 * An Order is the root of the order -> shift -> schedule model: POST /planning/shifts
 * REQUIRES planning_order_id, so a shift/candidate assignment can never exist before
 * an order does. This hook is the create-order step that was missing entirely.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { unwrapList, unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

// One order row as the API actually returns it (PlanningOrderResource).
export interface PlanningOrderRow {
  id: Id
  customer_id: Id | null
  client: string | null
  customer_location_id: Id | null
  location: string | null
  customer_department_id: Id | null
  department: string | null
  owner_id: Id | null
  function: string | null
  reference: string | null
  subject: string | null
  description: string | null
  cost_center: string | null
  status: string
  notes: string | null
  shifts_count: number
  created_at: string
}

// The exact body PlanningOrderController::validated() accepts on create.
export interface PlanningOrderInput {
  customer_id?: string | null
  customer_location_id?: string | null
  customer_department_id?: string | null
  owner_id?: string | null
  function?: string | null
  reference?: string | null
  subject?: string | null
  description?: string | null
  cost_center?: string | null
  status?: string
  notes?: string | null
}

const ORDERS_KEY = ['planning', 'orders'] as const

// Query cache stays stable-empty while loading — a fresh [] every render would
// re-trigger any effect keyed on this array.
const EMPTY_ORDERS: PlanningOrderRow[] = []

/** GET /planning/orders — the tenant's live order list, newest first (server order). */
export function usePlanningOrdersList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<PlanningOrderRow>(await api.get('/planning/orders', { params: { per_page: 100 }, signal }))
      return rows
    },
  })
  return { orders: data ?? EMPTY_ORDERS, loading: isLoading, error: isError }
}

/** POST /planning/orders — creates the order, then invalidates the shared list. */
export function useCreatePlanningOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: PlanningOrderInput) => unwrap<PlanningOrderRow>(await api.post('/planning/orders', body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  })
}

/** PATCH /planning/orders/{order} — edits the order, then invalidates the shared list. */
export function useUpdatePlanningOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: Id; body: PlanningOrderInput }) =>
      unwrap<PlanningOrderRow>(await api.patch(`/planning/orders/${id}`, body)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  })
}

/**
 * DELETE /planning/orders/{order} — the server 409s (with a real reason) while the
 * order still has non-cancelled shifts hanging off it; the caller surfaces that
 * reason via extractApiError rather than a generic failure (§3, honest errors).
 */
export function useDeletePlanningOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: Id) => { await api.delete(`/planning/orders/${id}`) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  })
}
