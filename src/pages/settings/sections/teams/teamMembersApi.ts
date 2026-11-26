// Team member API (TEAM-MEMBERS-1): hand-written types, the OpenAPI export carries no 2xx schema.
import api, { unwrapList } from '@/lib/api'

export interface TeamMember { id: string; user_id: string; name: string }

// Load the members of one team (bare array or data envelope).
export async function listTeamMembers(teamId: string | number, signal?: AbortSignal): Promise<TeamMember[]> {
  const res = await api.get(`/teams/${teamId}/members`, { signal })
  return unwrapList<TeamMember>(res).rows
}

// Replace the whole member list; the 422 is rendered by the caller, so the client stays quiet.
export async function replaceTeamMembers(teamId: string | number, userIds: string[]): Promise<TeamMember[]> {
  const res = await api.put(`/teams/${teamId}/members`, { user_ids: userIds }, { quietStatuses: [422] })
  return unwrapList<TeamMember>(res).rows
}
