/**
 * Candidate-drawer data hooks — per-tab fetches live here so the tab components
 * (ChangelogTab, BranchSection) stay presentational (§3: logic in hooks, not JSX).
 * All GET-loads are tolerant of a missing endpoint (treated as empty, never a
 * hard error) and abort on unmount.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import type { Id } from '@/types/common'

/** One entry in the candidate audit trail (GET /candidates/{id}/activity, C-16). */
export interface ActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  // C-16: audit entries carry the subject + originating IP.
  subject_type?: string
  subject_id?: Id
  ip?: string
}

// Candidate audit trail (C-16). 404 = endpoint not built yet → empty (calm), not
// an error. Returns the four-state building blocks the tab renders.
export function useCandidateActivity(id?: Id): { items: ActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(res.data?.data ?? res.data ?? []))
      .catch(err => {
        if (isAbortError(err)) return
        // 404 = endpoint not built yet → treat as empty (calm), not a hard error.
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [id])

  return { items, loading, error }
}

export interface BranchOption { value: string; label: string }

interface CustomerLite { name?: string; company_name?: string; id?: Id }

// Customer branches as {value,label} options (GET /customers) for the branch link.
export function useBranchCustomerOptions(): BranchOption[] {
  const [options, setOptions] = useState<BranchOption[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(r => {
        const rows = unwrapList<CustomerLite>(r).rows
        setOptions(rows
          .map(l => { const name = String(l.name ?? l.company_name ?? l.id ?? ''); return { value: name, label: name } })
          .filter(o => o.value))
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return options
}
