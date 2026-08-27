/**
 * useVacancyOptions — vacancy picker options for the candidate drawer's direct-match
 * flow (G-2). Loads /vacancies via React Query, only while `enabled` (i.e. the placed
 * prompt is open), and maps each row to { value: id, label: title, client }. An empty
 * list on failure, never fabricated rows (§3).
 *
 * OWNER-DEVIATION-1: also carries ownerId/ownerName — VacancyListResource.php:71-75
 * already resolves `owner: { id, name }` on this same /vacancies row, so the
 * "+ Solliciteren" owner-deviation notice (AddApplicationModal) reads it straight
 * off the option the recruiter already picked, no extra fetch-on-pick needed.
 *
 * W30: an optional `search` string forwards a `?search=` param — the 100-row cap
 * per page stays (server-side search narrows within it), so a >100-vacancy tenant
 * can still find a vacancy the flat mount fetch would never surface. Callers that
 * pass no search keep the original unfiltered 100-row list, byte-for-byte.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyOption { value: Id; label: string; client?: string; ownerId?: Id; ownerName?: string }

// Vacancy picker options, each carrying its owner id/name too (see the module doc
// comment above for why that saves an extra fetch on pick); disabled until `enabled` flips on.
export function useVacancyOptions(enabled: boolean, search = ''): VacancyOption[] {
  const { data } = useQuery({
    queryKey: ['vacancies', 'options', search],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string; owner?: { id?: Id; name?: string } | null }>(
        await api.get('/vacancies', { params: { per_page: 100, ...(search ? { search } : {}) }, signal }),
      )
      return rows.map(v => ({
        value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
        ownerId: v.owner?.id, ownerName: v.owner?.name,
      })) as VacancyOption[]
    },
  })
  return data ?? []
}
