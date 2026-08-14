/**
 * VacancyTasksTab — V-tasks-1: the request IS the point (mirrors useEntityTasks's
 * own test doctrine). Proves this tab actually asks for tasks SCOPED to the
 * vacancy (linkType 'vacancy'), never the full tenant list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import VacancyTasksTab from './VacancyTasksTab'
import api from '@/lib/api'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (res: { data?: { data?: unknown[] } }) => ({
    rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0,
  }),
  getActiveTenantId: () => 'tenant-1',
}))
// No real tenant lookups fetch needed for this request-shape assertion.
vi.mock('@/context/TaskLookupsContext', () => ({
  TaskLookupsProvider: ({ children }: { children: React.ReactNode }) => children,
  useTaskLookups: () => ({ statuses: [], types: [], priorities: [] }),
}))

beforeEach(() => { vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: [] } }) })

describe('VacancyTasksTab · scoped request (V-tasks-1)', () => {
  it('GETs /tasks with { vacancy: id } — never the unfiltered list', async () => {
    render(<VacancyTasksTab vacancy={{ id: 'v-42' } as VacancyDetail} />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      params: { vacancy: 'v-42', per_page: 100 },
    }))
  })
})
