/**
 * jobsApi — verifies each QUEUE-VIEW-1 wrapper hits the exact route/method/params
 * the backend controller (JobQueueController) declares, so a routing typo here
 * would fail fast instead of surfacing as a silent 404 in the Taakbeheer UI.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import {
  fetchQueueSummary, fetchJobsList, fetchFailedJobs,
  cancelJob, retryFailedJob, retryAllFailedJobs, forgetFailedJob, flushFailedJobs,
} from './jobsApi'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('jobsApi', () => {
  it('fetchQueueSummary reads GET /admin/jobs and unwraps { data }', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { by_queue: [], by_tenant: [] } } })
    const result = await fetchQueueSummary()
    expect(api.get).toHaveBeenCalledWith('/admin/jobs', { signal: undefined })
    expect(result).toEqual({ by_queue: [], by_tenant: [] })
  })

  it('fetchJobsList reads GET /admin/jobs/list with the given params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 0 } })
    await fetchJobsList({ page: 2, per_page: 25, queue: 'default' })
    expect(api.get).toHaveBeenCalledWith('/admin/jobs/list', { params: { page: 2, per_page: 25, queue: 'default' }, signal: undefined })
  })

  it('fetchFailedJobs reads GET /admin/jobs/failed with the given params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 0 } })
    await fetchFailedJobs({ page: 1, per_page: 25 })
    expect(api.get).toHaveBeenCalledWith('/admin/jobs/failed', { params: { page: 1, per_page: 25 }, signal: undefined })
  })

  it('cancelJob sends DELETE /admin/jobs/{id}', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    await cancelJob(42)
    expect(api.delete).toHaveBeenCalledWith('/admin/jobs/42')
  })

  it('retryFailedJob sends POST /admin/jobs/failed/{uuid}/retry', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    await retryFailedJob('abc-123')
    expect(api.post).toHaveBeenCalledWith('/admin/jobs/failed/abc-123/retry')
  })

  it('retryAllFailedJobs sends POST /admin/jobs/failed/retry-all', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { count: 3 } })
    await retryAllFailedJobs()
    expect(api.post).toHaveBeenCalledWith('/admin/jobs/failed/retry-all')
  })

  it('forgetFailedJob sends DELETE /admin/jobs/failed/{uuid}', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    await forgetFailedJob('abc-123')
    expect(api.delete).toHaveBeenCalledWith('/admin/jobs/failed/abc-123')
  })

  it('flushFailedJobs sends DELETE /admin/jobs/failed with the required confirm body', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    await flushFailedJobs()
    expect(api.delete).toHaveBeenCalledWith('/admin/jobs/failed', { data: { confirm: true } })
  })
})
