// Request-shape tests for the team members API (method, route, exact body).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import { listTeamMembers, replaceTeamMembers } from './teamMembersApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPut = api.put as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset(); mockPut.mockReset() })

describe('teamMembersApi', () => {
  // GET tolerates a bare array.
  it('GETs /teams/t1/members and returns the rows', async () => {
    const rows = [{ id: 'm1', user_id: 'u1', name: 'Ann' }]
    mockGet.mockResolvedValue({ data: rows })
    expect(await listTeamMembers('t1')).toEqual(rows)
    expect(mockGet).toHaveBeenCalledWith('/teams/t1/members', { signal: undefined })
  })

  // PUT replaces the list with exactly { user_ids } and keeps 422 quiet.
  it('PUTs /teams/t1/members with exactly { user_ids } and quiet 422', async () => {
    mockPut.mockResolvedValue({ data: { data: [{ id: 'm1', user_id: 'u2', name: 'Bo' }] } })
    const rows = await replaceTeamMembers('t1', ['u2'])
    expect(mockPut).toHaveBeenCalledWith('/teams/t1/members', { user_ids: ['u2'] }, { quietStatuses: [422] })
    expect(rows).toEqual([{ id: 'm1', user_id: 'u2', name: 'Bo' }])
  })
})
