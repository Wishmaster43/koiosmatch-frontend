/**
 * useCustomerOptions — customer picker options for the vacancy Details editor.
 * Fetched only while editing (enabled), capped page; mirrors useVacancyOptions.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface CustomerOption { value: Id; label: string }

// Stable empty-array fallback. A fresh `[]` per render gives the caller a new
// identity every time, and a consumer that feeds these options into a memo behind
// an effect (the reports right panel does exactly that) then re-registers on every
// render: register → context state → re-render → register, until React gives up
// with "Maximum update depth exceeded". The smoke suite caught this on the real
// Reports page while every unit test stayed green, because the tests mock this
// hook with a stable reference. One shared constant, no loop.
const EMPTY_CUSTOMER_OPTIONS: CustomerOption[] = []

// Customer picker options, fetched only while enabled; returns the shared stable empty array so a consumer feeding this into a memo never loops on a fresh [] identity (see file header).
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
  return data ?? EMPTY_CUSTOMER_OPTIONS
}
