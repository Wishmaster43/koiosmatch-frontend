/**
 * jobsApi — thin wrapper around the QUEUE-VIEW-1 super-admin endpoints
 * (T4.1, extended). Every call hits the CENTRAL `/admin/jobs*` routes (no
 * tenant DB involved) and returns metadata only — the backend never sends a
 * job payload body (queue/tenant/class-name/timing only, §8 no PII).
 * One file, no React — the hooks in this folder own state/polling.
 *
 * Type-gen adoption (item 12, CLAUDE.md §10): the list/failed-list REQUEST
 * params below are typed from `src/types/api-generated.ts` (openapi-typescript),
 * so a param rename in the backend's FormRequest surfaces as a compile error
 * here instead of a silent runtime 422. The generated spec does NOT carry a
 * success (2xx) response schema for these routes (only the 401 shape is
 * documented) — `QueueSummary` below is therefore hand-written from the
 * fields QueueOverviewTab actually reads, per the policy's second half.
 */
import type { AxiosResponse } from 'axios'
import api, { unwrap } from '@/lib/api'
import type { operations } from '@/types/api-generated'

// Request param shapes lifted from the generated spec (getAdminJobsList /
// getAdminJobsFailed) — NonNullable since openapi-typescript marks GET query
// bodies optional even though this wrapper always sends an object.
type JobsListParams   = NonNullable<operations['getAdminJobsList']['requestBody']>['content']['application/json']
type FailedJobsParams = NonNullable<operations['getAdminJobsFailed']['requestBody']>['content']['application/json']

// Hand-written — the spec carries no 2xx schema for GET /admin/jobs (§ above).
export interface QueueBucket {
  status: 'active' | 'stalled' | 'idle'
  pending: number
  reserved: number
  oldest_pending_age_seconds?: number | null
  oldest_reserved_age_seconds?: number | null
}
export interface QueueSummary {
  by_queue: Array<QueueBucket & { queue: string }>
  by_tenant: Array<QueueBucket & { tenant_id: string }>
  failed_total?: number
  // Non-database queue driver (e.g. sync/redis without this inspector) — the
  // overview tab warns instead of showing all-zero counts (BE audit 15-07).
  driver?: string
  status?: string
}

// GET /admin/jobs — per-queue + per-tenant pending/reserved health + worker heartbeat.
export const fetchQueueSummary = (signal?: AbortSignal): Promise<QueueSummary> =>
  api.get('/admin/jobs', { signal }).then((res) => unwrap<QueueSummary>(res) ?? { by_queue: [], by_tenant: [] })

// GET /admin/jobs/list — individual pending/reserved jobs (paginated, max 100/page).
// Returns the raw axios response (not pre-unwrapped) — the caller feeds it straight
// into the shared `unwrapList` helper, which expects that exact shape (§10 dialect 3).
export const fetchJobsList = (params: JobsListParams, signal?: AbortSignal): Promise<AxiosResponse> =>
  api.get('/admin/jobs/list', { params, signal })

// GET /admin/jobs/failed — failed jobs (paginated, max 100/page). Same contract as above.
export const fetchFailedJobs = (params: FailedJobsParams, signal?: AbortSignal): Promise<AxiosResponse> =>
  api.get('/admin/jobs/failed', { params, signal })

// DELETE /admin/jobs/{id} — cancel a job that hasn't started running yet (409 if reserved).
export const cancelJob = (id: string | number) => api.delete(`/admin/jobs/${id}`)

// POST /admin/jobs/failed/{uuid}/retry — re-queue one failed job.
export const retryFailedJob = (uuid: string) => api.post(`/admin/jobs/failed/${uuid}/retry`)

// POST /admin/jobs/failed/retry-all — re-queue every failed job; returns { count }.
export const retryAllFailedJobs = () => api.post('/admin/jobs/failed/retry-all')

// DELETE /admin/jobs/failed/{uuid} — drop one failed job permanently.
export const forgetFailedJob = (uuid: string) => api.delete(`/admin/jobs/failed/${uuid}`)

// DELETE /admin/jobs/failed — clear ALL failed jobs (explicit confirm body required by the API).
export const flushFailedJobs = () => api.delete('/admin/jobs/failed', { data: { confirm: true } })
