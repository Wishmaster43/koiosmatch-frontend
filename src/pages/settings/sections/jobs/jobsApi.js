/**
 * jobsApi — thin wrapper around the QUEUE-VIEW-1 super-admin endpoints
 * (T4.1, extended). Every call hits the CENTRAL `/admin/jobs*` routes (no
 * tenant DB involved) and returns metadata only — the backend never sends a
 * job payload body (queue/tenant/class-name/timing only, §8 no PII).
 * One file, no React — the hooks in this folder own state/polling.
 */
import api from '@/lib/api'

// GET /admin/jobs — per-queue + per-tenant pending/reserved health + worker heartbeat.
export const fetchQueueSummary = (signal) =>
  api.get('/admin/jobs', { signal }).then((res) => res.data?.data ?? res.data ?? {})

// GET /admin/jobs/list — individual pending/reserved jobs (paginated, max 100/page).
// Returns the raw axios response (not pre-unwrapped) — the caller feeds it straight
// into the shared `unwrapList` helper, which expects that exact shape (§10 dialect 3).
export const fetchJobsList = (params, signal) => api.get('/admin/jobs/list', { params, signal })

// GET /admin/jobs/failed — failed jobs (paginated, max 100/page). Same contract as above.
export const fetchFailedJobs = (params, signal) => api.get('/admin/jobs/failed', { params, signal })

// DELETE /admin/jobs/{id} — cancel a job that hasn't started running yet (409 if reserved).
export const cancelJob = (id) => api.delete(`/admin/jobs/${id}`)

// POST /admin/jobs/failed/{uuid}/retry — re-queue one failed job.
export const retryFailedJob = (uuid) => api.post(`/admin/jobs/failed/${uuid}/retry`)

// POST /admin/jobs/failed/retry-all — re-queue every failed job; returns { count }.
export const retryAllFailedJobs = () => api.post('/admin/jobs/failed/retry-all')

// DELETE /admin/jobs/failed/{uuid} — drop one failed job permanently.
export const forgetFailedJob = (uuid) => api.delete(`/admin/jobs/failed/${uuid}`)

// DELETE /admin/jobs/failed — clear ALL failed jobs (explicit confirm body required by the API).
export const flushFailedJobs = () => api.delete('/admin/jobs/failed', { data: { confirm: true } })
