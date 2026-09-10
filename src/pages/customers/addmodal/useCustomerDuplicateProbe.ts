/**
 * useCustomerDuplicateProbe — the customer-side "warn while you type" duplicate
 * check (CUST-DUP-FE-1, 2026-08-22). Mirrors the candidate's own useDuplicateProbe
 * (pages/candidates/addmodal/useDuplicateProbe.ts) 1:1 — same debounce, same
 * abort-on-edit, same POST-body-only rule.
 *
 * Backend contract (commit e4f4bb1c): POST /customers/check-duplicate accepts
 * name/coc_number/vat_number/debtor_number/billing_email; the default tenant
 * dedupe keys are ['coc_number', 'name'] (DuplicateFinder). This probe only sends
 * the three fields the create form actually collects — name, coc_number (added by
 * this same delivery) and billing_email. vat_number/debtor_number are NOT
 * collected at customer creation (DEBITEURNUMMER-1, Danny 02-08: the debtor number
 * stays editable everywhere else, decided later; vat_number was never part of the
 * create form either) — reviving either field here would contradict that
 * deliberate decision, so this probe simply never sends them.
 *
 * POST, never GET: coc/billing details in a query string would land in access
 * logs/proxies/history (§7) — same reason the candidate probe has both verbs but
 * only ever calls the POST one.
 *
 * Scope note: this live warning covers the DEFAULT dedupe keys only. A tenant who
 * adds vat_number/debtor_number to customer_dedupe_keys still gets the hard 409
 * on create (the real gate) — just no pre-warning on those extra keys.
 */
import { useTranslation } from 'react-i18next'
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
import { useDuplicateProbe as useDuplicateProbeBase, useRestoreArchivedDuplicate } from '@/hooks/useDuplicateProbe'

// Module-scope so the tuple reference stays stable across renders (the shared
// hook depends on it — a fresh array literal per render would re-probe every time).
const CUSTOMER_DUP_KEYS = ['name', 'coc_number', 'billing_email'] as const

// Debounced live probe: name/cocNumber/billingEmail in, a possible match out. Any
// edit clears the previous verdict — it no longer applies to what's on screen.
// Delegates to the shared hooks/useDuplicateProbe (DRY-1) — this wrapper only
// fixes the path/keys.
export function useCustomerDuplicateProbe(name: string, cocNumber: string, billingEmail: string) {
  return useDuplicateProbeBase<DuplicateMatch>('/customers/check-duplicate', CUSTOMER_DUP_KEYS, name, cocNumber, billingEmail)
}

// Restore an archived duplicate via the per-id route — delegates to the shared
// hooks/useDuplicateProbe (DRY round 11); this wrapper only fixes entity/messages.
export function useRestoreCustomerDuplicate() {
  const { t } = useTranslation('customers')
  return useRestoreArchivedDuplicate({
    entity: 'customers',
    messages: {
      restored: t('duplicate.restored'),
      restoreForbidden: t('duplicate.restoreForbidden'),
      restoreFailed: t('duplicate.restoreFailed'),
    },
  })
}
