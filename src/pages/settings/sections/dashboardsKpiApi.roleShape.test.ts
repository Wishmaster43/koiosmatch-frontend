/**
 * dashboardsKpiApi — K2-FE-GOLF-1 regression: GET /dashboard/kpis/{role} answers a BARE
 * array (`{ data: ["candidates_total", …] }`, DashboardKpiSettingsController:37). The
 * old reader took `.kpis` off it and silently resolved every role to an empty list.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { fetchDashboardKpisRole } from './dashboardsKpiApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('fetchDashboardKpisRole', () => {
  it('reads the real bare-array envelope', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: ['candidates_total', 'no_such_server_key'] } })
    const keys = await fetchDashboardKpisRole('planning')
    expect(api.get).toHaveBeenCalledWith('/dashboard/kpis/planning', { signal: undefined })
    expect(keys.length).toBeGreaterThan(0)
    expect(keys).not.toContain('no_such_server_key')
  })

  it('still tolerates the wrapped { kpis } shape', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { kpis: ['candidates_total'] } } })
    expect((await fetchDashboardKpisRole('planning')).length).toBeGreaterThan(0)
  })

  it('resolves to an empty list on an empty answer, never throws', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    expect(await fetchDashboardKpisRole('planning')).toEqual([])
  })
})
