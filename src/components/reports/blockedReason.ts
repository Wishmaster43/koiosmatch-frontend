/**
 * blockedReason — the human sentence behind a run halted by a connector limit (F7).
 * A pure helper in its own module so runFormat.tsx keeps exporting components only.
 */
import type { RunRow } from '@/types/reports'

// F7 fix: RunPresenter.errorMessage (BE) only pulls from a log row with
// status==='failed' — a connector-capped step settles as 'skipped', so
// run.error_message is empty for a blocked run today (hash-back open with
// CMBE). The cap reason instead surfaces on the capped step itself. We
// prefer step_results over steps for the K-111 reason LogsPanel.tsx:128-130
// gives on a dry-run — the engine settles a blocked send step green in
// steps[] and writes the honest 'skipped' only to the log rows. The BE
// contract does not yet pin which field on that step carries the cap
// sentence (CONTRACT-CHANGELOG.md:440; sibling row F6 step_results[].reason
// is still open on the BE hash, HANDOVER-CMBE-2026-09-10.md:92) — the only
// documented precedent (WF-DRYRUN-1, archive/WORKLIST-DONE.md:23) puts a
// skipped step's human sentence in its `error` field, so this is a tolerant
// read across `message`/`error`/`error_message`, not a pinned contract field.
export function blockedReason(run: RunRow): string | null {
  if (run.status !== 'blocked') return null
  const steps = (run.step_results?.length ? run.step_results : run.steps) ?? []
  const capped = [...steps].reverse().find(
    (s) => s.status === 'skipped' && (s.message || s.error || s.error_message)
  )
  // `||`, not `??`: a step serialised with message '' and a real `error` must fall through to the sentence.
  return capped?.message || capped?.error || capped?.error_message || run.error_message || null
}
