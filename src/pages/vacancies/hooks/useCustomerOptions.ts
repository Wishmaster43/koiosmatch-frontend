/**
 * useCustomerOptions — customer picker options for the vacancy Details editor.
 * Fetched only while editing (enabled), capped page; mirrors useVacancyOptions.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface CustomerOption { value: Id; label: string }

export function useCustomerOptions(enabled: boolean): CustomerOption[] {
  const { data } = useQuery({
    queryKey: ['customers', 'options'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<{ id?: Id; name?: string }>(
        await api.get('/customers', { params: { per_page: 100 }, signal }),
      )
      return rows.map(c => ({ value: c.id ?? '', label: c.name ?? '' })) as CustomerOption[]
    },
  })
  return data ?? []
}
