/**
 * useShiftLookups — real data sources for AddShiftModal (PLAN-LOOKUP-1). The modal
 * used to hardcode its customer/department selects and the candidate suggestion
 * list with Dutch demo data; these hooks replace that with tenant/API-backed data.
 *
 * Departments: this modal has no separate "Location" picker (unlike the
 * customer→location→department→contact chain in AddOpportunityModal/
 * MatchPlacementModal), so the three-level `useCustomerCascade` doesn't fit —
 * measured instead against `useCustomerDepartments` (customers feature), which
 * already returns the flat per-customer department list + loading/error, exactly
 * what this modal's single Department select needs.
 *
 * Candidates: the old SUGGESTIES mock faked a favourite flag + distance (km) +
 * hours-worked ranking. That ranking data doesn't exist yet — Native Planning's
 * "fit-annotation" (koiosmatch-api/docs/FRONTEND-CONTRACT.md §11) is still an
 * open slice (2-4), and there is no "favourite candidates for this customer"
 * endpoint (only the reverse: a candidate's OWN favourite/blacklist prefs via
 * /candidates/{id}/planning-preferences). Faking that ranking again would just
 * reintroduce the same problem, so this hook only does what's real: a debounced
 * server-side candidate search (GET /candidates?search=).
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { useCustomerDepartments } from '@/pages/customers/hooks/useCustomerDepartments'
import type { Id } from '@/types/common'

export interface ShiftLookupOption { id: Id; name: string }
export interface ShiftCandidateOption { id: Id; name: string; functionTitle: string }

interface ApiCustomerRow { id?: Id; name?: string; company_name?: string }
interface ApiCandidateRow { id?: Id; name?: string; first_name?: string; last_name?: string; function_title?: string; title?: string }

// Light customer list for the picker — id+name only, per_page:100 mirrors the
// other create-modal customer pickers (useCustomerOptions/useOpportunitiesData);
// written locally (not imported) so this hook can expose loading/error too.
export function useShiftCustomers() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['planning', 'shift-customers'],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<ApiCustomerRow>(await api.get('/customers', { params: { per_page: 100 }, signal }))
      return rows.map(c => ({ id: c.id ?? '', name: c.name ?? c.company_name ?? '—' })) as ShiftLookupOption[]
    },
  })
  return { customers: data ?? [], loading: isLoading, error: isError }
}

// A customer's departments — see the file header for why useCustomerDepartments
// (flat, one level) was picked over useCustomerCascade (location→department).
export function useShiftDepartments(customerId: Id | string) {
  const { departments, loading, error } = useCustomerDepartments(customerId || undefined)
  return { departments: departments.map(d => ({ id: d.id ?? '', name: d.name })) as ShiftLookupOption[], loading, error }
}

// Debounced candidate search (replaces the fabricated SUGGESTIES mock) — real
// rows from GET /candidates?search=, capped at a browsable page size.
export function useShiftCandidateSearch(query: string) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['planning', 'shift-candidates', debounced],
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<ApiCandidateRow>(
        await api.get('/candidates', { params: { search: debounced, per_page: 50 }, signal }),
      )
      return rows.map(c => ({
        id: c.id ?? '',
        name: c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' '),
        functionTitle: c.function_title ?? c.title ?? '',
      })) as ShiftCandidateOption[]
    },
  })
  return { candidates: data ?? [], loading: isLoading, error: isError }
}
