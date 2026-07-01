/**
 * Candidate-drawer data hooks — per-tab fetches live here so the tab components
 * (ChangelogTab, BranchSection) stay presentational (§3: logic in hooks, not JSX).
 * All GET-loads are tolerant of a missing endpoint (treated as empty, never a
 * hard error) and abort on unmount.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { notifyError } from '@/lib/notify'
import type { Candidate, CandidateBranch } from '@/types/candidate'
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

// Customer branches as id-keyed {value,label} options (GET /customers) for the
// branch link — value is the branch id so membership can persist by id (C-4).
export function useBranchCustomerOptions(): BranchOption[] {
  const [options, setOptions] = useState<BranchOption[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(r => {
        const rows = unwrapList<CustomerLite>(r).rows
        setOptions(rows
          .map(l => { const name = String(l.name ?? l.company_name ?? l.id ?? ''); return { value: String(l.id ?? name), label: name } })
          .filter(o => o.value && o.label))
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return options
}

// A candidate's branch membership (C-4, M2M): local optimistic chips + persisted
// add/remove via /candidates/{id}/branches; notifyError on failure (ERR-1). Tolerant
// while the backend endpoint is being (re)built — the options GET soft-fails too.
export function useCandidateBranches(candidate: Candidate) {
  const { t } = useTranslation('candidates')
  const options = useBranchCustomerOptions()
  const [branches, setBranches] = useState<CandidateBranch[]>(candidate.branches ?? [])

  // Membership key: prefer the id, fall back to the name for bare-slug branches.
  const keyOf = (b: CandidateBranch) => String(b.id ?? b.name)
  const selectedIds = branches.map(keyOf)

  // Optimistic add/remove, persisted to the pivot route (body: { branch_id }).
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setBranches(prev => prev.filter(b => keyOf(b) !== id))
      api.delete(`/candidates/${candidate.id}/branches/${id}`).catch(() => notifyError(t('common:actionFailed')))
    } else {
      const name = options.find(o => o.value === id)?.label ?? id
      setBranches(prev => [...prev, { id, name }])
      api.post(`/candidates/${candidate.id}/branches`, { branch_id: id }).catch(() => notifyError(t('common:actionFailed')))
    }
  }

  return { branches, options, selectedIds, toggle }
}
