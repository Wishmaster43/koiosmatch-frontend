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
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyOption { value: Id; label: string; client?: string; ownerId?: Id; ownerName?: string }

export function useVacancyOptions(enabled: boolean): VacancyOption[] {
  const { data } = useQuery({
    queryKey: ['vacancies', 'options'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; title?: string; titel?: string; client_name?: string; client?: string; owner?: { id?: Id; name?: string } | null }>(
        await api.get('/vacancies', { params: { per_page: 100 }, signal }),
      )
      return rows.map(v => ({
        value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
        ownerId: v.owner?.id, ownerName: v.owner?.name,
      })) as VacancyOption[]
    },
  })
  return data ?? []
}
