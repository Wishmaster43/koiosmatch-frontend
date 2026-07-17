/**
 * useUserBranches — a single user's branch coupling (VESTIGING-1 fase 1 /
 * USERS-ROLES-LOC-1): GET on mount, PUT replace-set on toggle. Mirrors
 * RoleBranchTemplate's settings-screen pattern 1:1 (plain state, optimistic
 * toggle, revert + notifyError on failure) rather than react-query — this is a
 * toggle-heavy, single-consumer resource where the settings screen's own
 * reference implementation already sets the house pattern; consistency (§0.9)
 * wins over introducing a second style for the same shape of data.
 *
 * IMPORTANT (read before relabeling this as "harmless"): VESTIGING-1 fase 2
 * shipped 2026-07-17 — a user with ANY row here is now HARD-scoped server-side
 * to those branches for candidates (list/KPI/detail/bulk; out-of-scope = 404).
 * An EMPTY set still means unrestricted (legacy/rollout-safe default), but a
 * non-empty set is a real, enforced restriction today, not just a "startset".
 * Vacancies/customers/etc. are not scoped yet (fase 3, dormant can_view/
 * can_update/can_delete flags) — keep that distinction honest in any copy.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { BranchRow } from '../usersParts'

export function useUserBranches(userId: string | number | null | undefined) {
  const { t } = useTranslation('users')
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Load the user's current branch set once (re-run if the edited user changes).
  useEffect(() => {
    if (userId == null) { setBranches([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    api.get(`/users/${userId}/branches`)
      .then(res => { if (!cancelled) setBranches(unwrapList<BranchRow>(res).rows) })
      .catch(() => { if (!cancelled) setBranches([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  // Toggle one branch — optimistic PUT (replace-set), revert + notify on failure.
  const toggle = async (locationId: string | number) => {
    if (userId == null) return
    const prev = branches
    const ids = branches.map(b => b.location_id)
    const nextIds = ids.includes(locationId) ? ids.filter(id => id !== locationId) : [...ids, locationId]
    setBranches(nextIds.map(id => prev.find(b => b.location_id === id) ?? { location_id: id }))
    setSaving(true)
    try {
      const res = await api.put(`/users/${userId}/branches`, { location_ids: nextIds })
      setBranches(unwrapList<BranchRow>(res).rows)
    } catch {
      setBranches(prev)
      notifyError(t('branches.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return { branches, loading, saving, toggle }
}
