/**
 * useCandidateStageBulk — the funnel/phase/status cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): `bulkSetStage`
 * (funnel stage), `bulkConvertPhase` (lifecycle phase) and `bulkSetStatus`
 * (deployability, with its AXIS-MATRIX-2 N2 bulk preflight) all share the
 * reasoned-skip breakdown below. `bulkMutate`/`notifyOutcome` stay owned by the
 * parent hook (shared with owner/type/tag/consent mutations too) and are passed
 * in so there is exactly one implementation of each — never a second copy here.
 */
import api from '@/lib/api'
import type { TFunction } from 'i18next'
import { metaOf } from '../data/candidatesShared'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'
import type { BulkMutateArgs } from './useCandidateBulkActions'

// AXIS-MATRIX-2 N2 — POST /action-rules/preflight-bulk's response shape (mirrors
// ActionRuleBulkPreflight::evaluate() verbatim, koiosmatch-api read-only per this
// task's file boundary). `breakdown` only ever carries warn/block groups (an
// allow cell never dialogs, docs/AXIS-MATRIX.md's own rule).
interface BulkPreflightGroup { condition: string; popup_code: string | null; effect: 'warn' | 'block'; count: number; sample_names: string[] }
interface BulkPreflightResult { total: number; allowed: number; warned: number; blocked: number; not_found: number; breakdown: BulkPreflightGroup[] }

// Narrow shape of useConfirm's `confirm` this cluster needs — structurally
// compatible with the real (broader-optioned) function passed in by the parent.
type ConfirmFn = (message: string, onConfirm: () => void, options?: { danger?: boolean }) => void

interface UseCandidateStageBulkParams {
  selectedIds: Set<Id>
  notify: (type: string, msg: string) => void
  t: TFunction
  funnelTypes: LookupItem[]
  confirm: ConfirmFn
  bulkMutate: (args: BulkMutateArgs) => void
  notifyOutcome: (successKey: string, params: Record<string, unknown>, updated: number, total: number) => void
}

export function useCandidateStageBulk({
  selectedIds, notify, t, funnelTypes, confirm, bulkMutate, notifyOutcome,
}: UseCandidateStageBulkParams) {
  // BULK-SKIP-REASONS-1: `/candidates/bulk/funnel-stage` and `/candidates/bulk/phase`
  // now return `skipped` as [{id, reason}] (every other bulk endpoint keeps the bare
  // id array — see notifyOutcome, unchanged for those). Group the reasons into a
  // human "N reason, M reason" string; returns '' when `skipped` isn't the reasoned
  // shape (defensive fallback — caller falls back to the old bare-count summary).
  const reasonBreakdown = (skipped?: unknown[]): string => {
    const reasoned = (skipped ?? []).filter(
      (s): s is { id: Id; reason: string } => typeof s === 'object' && s !== null && 'reason' in s,
    )
    if (!reasoned.length) return ''
    const counts: Record<string, number> = {}
    reasoned.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([reason, count]) => `${count} ${t(`bulk.skipReasons.${reason}`, { defaultValue: reason })}`)
      .join(', ')
  }

  // Move the selection to a funnel stage — the real bulk route (BULK-2) with single-PATCH
  // semantics (Match-spawn on hired, event after commit). Replaces the per-id bridge.
  // BULK-FUNNEL-SOLE-1: the BE now moves each candidate's ONE-AND-ONLY live application
  // (0 or >1 live applications → skipped, never silently guessed). BULK-SKIP-REASONS-1:
  // `skipped` now carries [{id,reason}] — show WHY, not just a bare count.
  const bulkSetStage = (stage: string) => bulkMutate({
    url: '/candidates/bulk/funnel-stage', body: { funnel_type: stage },
    patch: { stage }, keys: ['stage'],
    onSuccess: (n, total, skipped) => {
      const breakdown = reasonBreakdown(skipped)
      if (total > 0 && n < total && breakdown) {
        notify('warning', t('bulk.partialResultReasoned', {
          value: metaOf(funnelTypes, stage)?.label ?? stage, updated: n, total, skipped: total - n, breakdown,
        }))
        return
      }
      notifyOutcome('bulk.stageChanged', { value: metaOf(funnelTypes, stage)?.label ?? stage }, n, total)
    },
  })

  // Convert the selection to a phase (e.g. Lead→Kandidaat). The backend validates
  // each candidate against that phase's required fields; incomplete ones are skipped
  // (reconciled back via bulkMutate) → "X van Y gelukt" (warning when any skipped).
  // BULK-SKIP-REASONS-1: `skipped` now carries [{id,reason}] — show WHY when present.
  const bulkConvertPhase = (phase: string) => {
    const total = selectedIds.size
    bulkMutate({
      url: '/candidates/bulk/phase', body: { phase },
      patch: { phase }, keys: ['phase'],
      onSuccess: (n, _total, skipped) => {
        const breakdown = reasonBreakdown(skipped)
        if (n < total && breakdown) { notify('warning', t('bulk.convertResultReasoned', { updated: n, total, breakdown })); return }
        notify(n < total ? 'warning' : 'success', t('bulk.convertResult', { updated: n, total }))
      },
    })
  }

  // AXIS-MATRIX-2 N2 (docs/AXIS-MATRIX.md "Niet-interactieve contexten"): one
  // summary preflight BEFORE a guarded bulk mutation runs, so a recruiter sees
  // "{n} of {m} will be skipped" up front instead of only in the after-the-fact
  // partial-result toast. Of every candidate bulk mutation, `candidate.status_set`
  // is the ONLY one with a real action-rules catalog entry (CandidateBulkService::
  // status already re-checks the SAME guard server-side and skips blocked rows —
  // this call never invents a second source of truth, it just previews it). The
  // other bulk actions (owner/phase/candidate-type/tags/notes/archive/consent)
  // have no action-rules catalog token at all — their existing skip-and-reconcile
  // reporting (notifyOutcome/bulk.partialResult) already is the honest, only signal,
  // so they deliberately get no preflight call (no double gate).
  const fetchStatusBulkPreflight = (ids: Id[]): Promise<BulkPreflightResult> =>
    api.post('/action-rules/preflight-bulk', { action: 'candidate.status_set', candidate_ids: ids })
      .then(r => r.data as BulkPreflightResult)

  // Human label for one axis condition token (lead/available/temporarily_unavailable/
  // placed/blacklist/archived) — falls back to the raw token so an unmapped future
  // condition never renders blank.
  const axisConditionLabel = (condition: string): string => t(`bulk.axisConditions.${condition}`, { defaultValue: condition })

  // Set a (simple) deployability status for the selection. Match/reason-gated statuses
  // (placed/unavailable/blacklist) are excluded from bulk in the UI.
  const runBulkSetStatus = (status: string, label: string) => bulkMutate({
    url: '/candidates/bulk/status', body: { status },
    patch: { status }, keys: ['status'],
    onSuccess: (n, total) => notifyOutcome('bulk.statusChanged', { value: label }, n, total),
  })
  const bulkSetStatus = (status: string, label: string) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    fetchStatusBulkPreflight(ids)
      .then(({ total, blocked, breakdown }) => {
        // Nothing will be skipped — proceed exactly as before, no extra confirm.
        if (blocked <= 0) { runBulkSetStatus(status, label); return }
        const blockedGroups = breakdown.filter(g => g.effect === 'block')
        const reasons = blockedGroups.map(g => `${g.count} ${axisConditionLabel(g.condition)}`).join(', ')
        const proceed = total - blocked
        if (proceed <= 0) { notify('warning', t('bulk.statusAllBlocked', { total, reasons })); return }
        // 11.3: name a few of the blocked candidates (the preflight already returns
        // sample_names[] per group) so the recruiter sees WHO is blocked, not just a
        // count — capped + deduped since the same name can appear in >1 reason group.
        const names = [...new Set(blockedGroups.flatMap(g => g.sample_names))].slice(0, 3).join(', ')
        const message = names
          ? t('bulk.statusBlockedConfirmSample', { blocked, total, reasons, proceed, names })
          : t('bulk.statusBlockedConfirm', { blocked, total, reasons, proceed })
        confirm(message, () => runBulkSetStatus(status, label))
      })
      // The preflight is a courtesy preview, not a gate — a network hiccup or a
      // permission read-gap must never block the actual (still server-enforced) action.
      .catch(() => runBulkSetStatus(status, label))
  }

  return { bulkSetStage, bulkConvertPhase, bulkSetStatus }
}
