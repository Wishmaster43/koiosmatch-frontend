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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Id } from '@/types/common'
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'

// Same debounce window as the candidate probe — long enough that a normal typing
// burst never fires more than one request.
const PROBE_DEBOUNCE_MS = 500

// Debounced live probe: name/cocNumber/billingEmail in, a possible match out. Any
// edit clears the previous verdict — it no longer applies to what's on screen.
export function useCustomerDuplicateProbe(name: string, cocNumber: string, billingEmail: string) {
  const [match, setMatch] = useState<DuplicateMatch | null>(null)
  // Cancel the in-flight request when the inputs change again before it resolves.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    setMatch(null)
    if (!name.trim() && !cocNumber.trim() && !billingEmail.trim()) return undefined

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => {
      // POST body only — never a query string (§7).
      api.post('/customers/check-duplicate', {
        name: name.trim() || undefined,
        coc_number: cocNumber.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
      }, { signal: controller.signal })
        .then(res => {
          const data = res.data as { exists?: boolean; match?: DuplicateMatch | null }
          setMatch(data?.exists ? (data.match ?? null) : null)
        })
        // Cancelled or failed probes stay silent — advisory only, never blocks typing.
        .catch(() => {})
    }, PROBE_DEBOUNCE_MS)

    return () => { clearTimeout(timer); controller.abort() }
  }, [name, cocNumber, billingEmail])

  return { probeMatch: match, clearProbeMatch: () => setMatch(null) }
}

// Restore an archived duplicate via the per-id route (§10: een record = de
// per-id-route). The list/stats caches have no row for it yet, so invalidate them;
// the caller opens the record afterwards.
export function useRestoreCustomerDuplicate() {
  const { t } = useTranslation('customers')
  const [restoring, setRestoring] = useState(false)

  const restore = async (id: Id): Promise<boolean> => {
    setRestoring(true)
    try {
      await api.post(`/customers/${id}/restore`)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      notifySuccess(t('duplicate.restored'))
      return true
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('duplicate.restoreForbidden') : t('duplicate.restoreFailed'))
      return false
    } finally {
      setRestoring(false)
    }
  }

  return { restore, restoring }
}
