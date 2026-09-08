/**
 * useAdminBillingBudgets — loads /admin/billing-budgets once and derives
 * per-package drafts through the caller's own draftFromEntry (budgets card:
 * ai/workflow budgets; users card: seats). Extracted from BillingBudgetsCard
 * and BillingUsersCard to eliminate the identical load block.
 */
import { useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import type { AdminBillingBudgetsResponse, BillingBudgetEntry, BillingPackageKey } from '@/types/billingUsage'
import { PACKAGE_KEYS } from './billingCardStyles'

export function useAdminBillingBudgets<D>(draftFromEntry: (entry?: BillingBudgetEntry) => D) {
  const [data, setData] = useState<AdminBillingBudgetsResponse | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [drafts, setDrafts] = useState<Record<BillingPackageKey, D>>(() => {
    const initial = {} as Record<BillingPackageKey, D>
    for (const key of PACKAGE_KEYS) {
      initial[key] = draftFromEntry()
    }
    return initial
  })

  // Load package defaults + existing tenant overrides, building drafts through draftFromEntry.
  // draftFromEntry is a module-level function in both cards, so listing it keeps the
  // effect honest AND single-run (the reference never changes).
  useEffect(() => {
    let alive = true
    api.get('/admin/billing-budgets')
      .then((res) => {
        if (!alive) return
        const body = unwrap<AdminBillingBudgetsResponse>(res)
        setData(body ?? null)
        const next = {} as Record<BillingPackageKey, D>
        for (const key of PACKAGE_KEYS) {
          next[key] = draftFromEntry(body?.packages?.[key])
        }
        setDrafts(next)
        setPhase('ready')
      })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [draftFromEntry])

  return { data, setData, phase, drafts, setDrafts }
}
