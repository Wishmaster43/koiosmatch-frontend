/**
 * useDuplicateProbe — the live "warn while you type" duplicate check.
 *
 * DUPPOST (CONTRACT-CHANGELOG 2026-08-13, batch 13): the backend shipped a POST
 * variant of the probe — `POST /candidates/check-duplicate` with email/mobile/phone
 * in the BODY, same shape as the old GET. The GET took those fields as QUERY
 * PARAMETERS, so probing on every edit would have written a candidate's contact
 * details into web-server access logs, proxies and browser history — §7 forbids
 * PII in a query string. That is exactly why the GET variant is never called again
 * here; AddCandidateModal.test.tsx's regression test still asserts nobody calls
 * `getMock` with a `check-duplicate` URL, and it must keep passing.
 *
 * The probe is debounced and cancels its own in-flight request on the next edit
 * (§9): only the server is the duplicate authority — this is advisory, the create
 * 409 (useRestoreDuplicate's sibling flow) stays the real gate.
 */
import { useTranslation } from 'react-i18next'
// The duplicate shape lives with the shared DuplicateNotice panel (SHARED-DUP-1);
// re-exported here so candidate-internal importers keep their existing path.
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
import { useDuplicateProbe as useDuplicateProbeBase, useRestoreArchivedDuplicate } from '@/hooks/useDuplicateProbe'
export type { DuplicateMatch }

// Module-scope so the tuple reference stays stable across renders (the shared
// hook depends on it — a fresh array literal per render would re-probe every time).
const CANDIDATE_DUP_KEYS = ['email', 'mobile', 'phone'] as const

// Debounced live probe: email/mobile/phone in, a possible match out. Every field
// change (any of the three) clears the previous verdict — an edit means the last
// answer no longer applies to what's on screen. Delegates to the shared
// hooks/useDuplicateProbe (DRY-1) — this wrapper only fixes the path/keys.
export function useDuplicateProbe(email: string, mobile: string, phone: string) {
  return useDuplicateProbeBase<DuplicateMatch>('/candidates/check-duplicate', CANDIDATE_DUP_KEYS, email, mobile, phone)
}

// Restore an archived duplicate via the per-id route — delegates to the shared
// hooks/useDuplicateProbe (DRY round 11); this wrapper only fixes entity/messages.
export function useRestoreDuplicate() {
  const { t } = useTranslation('candidates')
  return useRestoreArchivedDuplicate({
    entity: 'candidates',
    messages: {
      restored: t('duplicate.restored'),
      restoreForbidden: t('duplicate.restoreForbidden'),
      restoreFailed: t('duplicate.restoreFailed'),
    },
  })
}
