/**
 * useBillingCardState — the shared head of BillingBudgetsCard and
 * BillingUsersCard: package/tenant data via useAdminBillingBudgets plus the
 * saving/savedOk confirmation flags every SaveButton-pattern billing card
 * carries. Wrapping useState calls in a custom hook does not change React's
 * hook call order (hooks are tracked by call sequence, not by nesting), so
 * both consumers keep identical render behaviour (DRY round 11, SETTINGS2).
 */
import { useState } from 'react'
import { useAdminBillingBudgets } from './useAdminBillingBudgets'
import type { BillingBudgetEntry } from '@/types/billingUsage'

export function useBillingCardState<D>(draftFromEntry: (entry?: BillingBudgetEntry) => D) {
  const { data, setData, phase, drafts, setDrafts } = useAdminBillingBudgets(draftFromEntry)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  return { data, setData, phase, drafts, setDrafts, saving, setSaving, savedOk, setSavedOk }
}
