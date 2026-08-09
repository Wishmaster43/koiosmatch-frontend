/**
 * useTeams — the tenant's INTERNAL departments/teams (GET /teams, BE TEAM-1).
 *
 * NAMING (Danny 09-08, the trap this feature walks into): Dutch calls two very
 * different things "afdeling". This hook serves the INTERNAL one — an own
 * organisational unit like Backoffice, Planning or Finance, the place a task
 * WAITS. It is NOT the CUSTOMER department behind the task-link token
 * `department` (`/departments`, a CustomerDepartment hanging off a customer,
 * see `pages/tasks/links/taskLinkTypes`). The two never share a label: this one
 * reads "Interne afdeling" (`tasks:*.team*`), that one "Klantafdeling"
 * (`tasks:links.department`).
 *
 * MEASURED live 09-08 (yesway): `GET /teams` → 200 with a BARE array of
 * `{id,name,color,in_use,created_at,updated_at}` (no pagination envelope —
 * unwrapList handles both), reads open to any task user, writes behind
 * settings.update. The tenant list is EMPTY today, which is exactly why the
 * `loading`/`error` flags below are exposed instead of a bare array: an empty
 * dropdown must be able to say "nothing configured yet" honestly, and a failed
 * load must never masquerade as "no departments" (§3 four UI states).
 * That is the one deliberate deviation from `useLocations`' bare-array shape.
 *
 * Tenant-keyed like `useUsers`: a super-admin switching bureau mid-session must
 * never be served the previous tenant's departments from cache.
 */
import { useQuery } from '@tanstack/react-query'
import api, { getActiveTenantId, unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

/** One internal department, in the shape every picker in this app consumes. */
export interface TeamOption {
  value: Id
  label: string
  // Lookup-owned colour; null when the tenant left it empty (SoftChip greys out).
  color: string | null
}

/** The four UI states a picker has to render, plus the options themselves. */
export interface TeamsState {
  teams: TeamOption[]
  loading: boolean
  error: boolean
  // Absent when the query hook exposes no refetch — never render a dead retry button.
  retry?: () => void
}

// ONE frozen empty array, never a fresh `[]` per render: a new identity each
// render rebuilds every memo downstream of it (the applications-page loop, 01-08).
const EMPTY: TeamOption[] = []

// Raw row as the endpoint serialises it — hand-written: the OpenAPI export
// carries no 2xx success schema for this route (§10 type-gen stance).
interface ApiTeam { id?: Id; name?: string; color?: string | null }

export function useTeams(): TeamsState {
  const tenantId = getActiveTenantId() ?? 'none'
  const { data, isFetching, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ['teams', tenantId],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<ApiTeam>(await api.get('/teams', { signal }))
      return rows.map(r => ({ value: r.id ?? '', label: r.name ?? '', color: r.color ?? null }))
    },
    placeholderData: EMPTY,
  })

  // `isLoading` never turns on with a placeholder in place (the query reports data
  // from the first render) — mirror useAssigneeOptions' fetching+placeholder test.
  return { teams: data ?? EMPTY, loading: isFetching && isPlaceholderData, error: isError, retry: refetch }
}
