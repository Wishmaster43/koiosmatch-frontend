/**
 * useMatchWeightTemplates — read-only list of the tenant's reusable match-weight
 * templates (MATCH-TEMPLATE-1) for the vacancy Matching tab's template picker.
 * Managing templates (create/edit/delete/apply) is a Settings screen owned by a
 * different wave — this hook only reads GET /settings/match-weight-templates.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

// One reusable weight preset: the 6 dimensions (1..5) + how many vacancies
// currently carry its snapshot (informational only, not used by this picker).
export interface MatchWeightTemplate {
  id: Id
  name: string
  weights: Record<string, number>
  linkedVacanciesCount: number
}

interface ApiTemplate {
  id?: Id
  name?: string
  weights?: Record<string, number>
  linked_vacancies_count?: number
}

export function useMatchWeightTemplates(): { templates: MatchWeightTemplate[]; loading: boolean; error: boolean } {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['match-weight-templates'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<ApiTemplate>(
        await api.get('/settings/match-weight-templates', { signal }),
      )
      return rows.map(r => ({
        id: r.id ?? '', name: r.name ?? '', weights: r.weights ?? {}, linkedVacanciesCount: r.linked_vacancies_count ?? 0,
      })) as MatchWeightTemplate[]
    },
  })
  return { templates: data ?? [], loading: isLoading, error: isError }
}
