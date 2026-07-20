/**
 * useCandidateBulkActions — the bulk operations for CandidatesPage: row/all
 * selection toggles, pool add/remove, owner/stage/type mutations, tag removal,
 * note add and archive. Each mutation is optimistic, persists, then reconciles
 * against the server's `updated`/`added`/`removed` list (reverts on failure).
 * Selection state + the toast `notify` live in the container and are passed in.
 *
 * AXIS-MATRIX-2 (CMFE audit R1): `bulkSetStatus` additionally runs the shared
 * N2 bulk preflight (`POST /action-rules/preflight-bulk`) before mutating — see
 * its own comment below for why it is the ONE bulk action here that gets it.
 */
import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { metaOf, initialsOf } from '../data/candidatesShared'
import { needsLiveCheck, fetchLiveBlockers, liveFromError } from '../data/archiveGuard'
import { useConfirm } from '@/hooks/useConfirm'
import type { BlockingApplication, BlockingMatch } from '../data/archiveGuard'
import type { Candidate, CandidatePool } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

// Bulk archive-guard modal state (§3B) — aggregate mode: N of the selection
// carry a live application/match; the same resolutions apply to all of them.
export interface BulkArchiveGuardTarget {
  ids: Id[]
  blockedCount: number
  totalCount: number
  applications: BlockingApplication[]
  matches: BlockingMatch[]
}
// Pre-check is bounded — a huge selection shouldn't fire dozens of detail
// fetches just to open a bulk-archive confirm; beyond the cap the 409
// forward-compat catch on the actual bulk call is the safety net.
const BULK_GUARD_CHECK_CAP = 25

// Bulk-merge entry (punt 4) — exactly 2 rows selected opens the existing
// MergeCandidateModal with the FIRST selected as `current` and the SECOND
// prefilled as the picked duplicate (mirrors the modal's own LiteCandidate shape).
export interface BulkMergeLite { id: Id; name: string; code?: string; email?: string }
export interface BulkMergeTarget { current: BulkMergeLite; other: BulkMergeLite }

// AXIS-MATRIX-2 N2 — POST /action-rules/preflight-bulk's response shape (mirrors
// ActionRuleBulkPreflight::evaluate() verbatim, koiosmatch-api read-only per this
// task's file boundary). `breakdown` only ever carries warn/block groups (an
// allow cell never dialogs, docs/AXIS-MATRIX.md's own rule).
interface BulkPreflightGroup { condition: string; popup_code: string | null; effect: 'warn' | 'block'; count: number; sample_names: string[] }
interface BulkPreflightResult { total: number; allowed: number; warned: number; blocked: number; not_found: number; breakdown: BulkPreflightGroup[] }

interface UseCandidateBulkActionsParams {
  candidates: Candidate[]
  setCandidates: Dispatch<SetStateAction<Candidate[]>>
  setTotal: Dispatch<SetStateAction<number>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  funnelTypes: LookupItem[]
  candidateTypes: LookupOption[]
}

interface BulkMutateArgs {
  url: string
  body?: Record<string, unknown>
  patch: Partial<Candidate>
  keys: Array<keyof Candidate>
  // Job 42: called with (updated, total) so every caller can surface an honest
  // partial-failure summary instead of a bare "success" that hides a skip.
  onSuccess: (updated: number, total: number) => void
}

export function useCandidateBulkActions({
  candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes,
}: UseCandidateBulkActionsParams) {
  const { confirm, dialog } = useConfirm()
  // ── Bulk selection ──
  const toggleRow = (id: Id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const next = new Set(prev)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    return next
  })

  // Add the selection to a pool: patch the pool column optimistically, persist,
  // and revert + warn on failure (only candidates lacking the pool change).
  const bulkAddToPool = (pool: CandidatePool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip: CandidatePool = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && !(c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
    api.post(`/pools/${poolId}/candidates`, { candidate_ids: ids })
      .then((res) => {
        const added = Array.isArray(res.data?.added) ? new Set(res.data.added) : null
        if (added) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !added.has(c.id))
          ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notifyOutcome('bulk.addedToPool', { pool: pool.name }, added ? added.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }
  // Remove the selection from a pool: same optimistic + revert pattern.
  const bulkRemoveFromPool = (pool: CandidatePool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip: CandidatePool = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
    api.delete(`/pools/${poolId}/candidates`, { data: { candidate_ids: ids } })
      .then((res) => {
        const removed = Array.isArray(res.data?.removed) ? new Set(res.data.removed) : null
        if (removed) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !removed.has(c.id))
          ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notifyOutcome('bulk.removedFromPool', { pool: pool.name }, removed ? removed.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }

  // Snapshot a subset of fields, for optimistic revert/reconcile.
  const subsetOf = <T,>(obj: T, keys: Array<keyof T>): Partial<T> =>
    keys.reduce((a, k) => { a[k] = obj[k]; return a }, {} as Partial<T>)

  // Job 42 — the ONE partial-failure summary rule for every bulk action: a full
  // success keeps the action's own descriptive toast ("Owner changed to X (3)");
  // the moment the server's reconcile skips ≥1 row, the toast switches to a
  // warning with an honest "N of M adjusted, Z skipped" count (bulk.partialResult)
  // — never a bare "success" that silently swallows `skipped`. Every bulkX below
  // routes its toast through this so the behaviour is uniform, not per-action.
  const notifyOutcome = (successKey: string, params: Record<string, unknown>, updated: number, total: number) => {
    if (total > 0 && updated < total) {
      notify('warning', t('bulk.partialResult', { ...params, updated, total, skipped: total - updated }))
    } else {
      notify('success', t(successKey, { ...params, count: updated }))
    }
  }

  // Generic optimistic bulk field mutation: apply `patch` to the selected rows,
  // persist, reconcile against the server's `updated` list, revert on failure.
  const bulkMutate = ({ url, body, patch, keys, onSuccess }: BulkMutateArgs) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(candidates.filter(c => ids.includes(c.id)).map(c => [c.id, subsetOf(c, keys)]))
    setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...patch } : c))
    api.post(url, { candidate_ids: ids, ...body })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (ids.includes(c.id) && !updated.has(c.id)) ? { ...c, ...snap.get(c.id) } : c))
        onSuccess(updated ? updated.size : ids.length, ids.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...snap.get(c.id) } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  // Change the owner/recruiter for the selection.
  const bulkSetOwner = (user: { id: Id; name: string }) => bulkMutate({
    url: '/candidates/bulk/owner', body: { owner_id: user.id },
    patch: { owner: user.name, ownerId: user.id, ownerInitials: initialsOf(user.name), ownerColor: undefined },
    keys: ['owner', 'ownerId', 'ownerInitials', 'ownerColor'],
    onSuccess: (n, total) => notifyOutcome('bulk.ownerChanged', { name: user.name }, n, total),
  })
  // Move the selection to a funnel stage — the real bulk route (BULK-2) with single-PATCH
  // semantics (Match-spawn on hired, event after commit). Replaces the per-id bridge.
  // Job 35: the BE moves each candidate's LATEST application (no vacancy scope) — a
  // candidate without one is `skipped`, surfaced honestly via notifyOutcome below.
  const bulkSetStage = (stage: string) => bulkMutate({
    url: '/candidates/bulk/funnel-stage', body: { funnel_type: stage },
    patch: { stage }, keys: ['stage'],
    onSuccess: (n, total) => notifyOutcome('bulk.stageChanged', { value: metaOf(funnelTypes, stage)?.label ?? stage }, n, total),
  })
  // Set the EXACT candidate-type set for the selection (multi-select add/remove).
  // An empty set clears all types — so an unused type can then be deleted in Settings.
  const bulkSetTypes = (types: string[]) => bulkMutate({
    url: '/candidates/bulk/candidate-type', body: { candidate_types: types },
    patch: { candidateTypes: types }, keys: ['candidateTypes'],
    onSuccess: (n, total) => notifyOutcome('bulk.typeChanged', {
      value: types.length ? types.map(v => metaOf(candidateTypes, v)?.label ?? v).join(', ') : t('bulk.noneLabel'),
    }, n, total),
  })

  // Union of tags across the selected candidates — the "remove tag" option list.
  const selectedTags = useMemo(() => {
    const set = new Set<string>()
    candidates.forEach(c => { if (selectedIds.has(c.id)) (c.tags ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [candidates, selectedIds])

  // Remove a tag from every selected candidate that has it (optimistic + reconcile).
  const bulkRemoveTag = (tag: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !tag) return
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/candidates/bulk/tags/remove', { candidate_ids: ids, tag })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !updated.has(c.id)) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notifyOutcome('bulk.tagRemoved', { tag }, updated ? updated.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  // Add the same note to every selected candidate (no table column → toast only).
  const bulkAddNote = (text: string) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post('/candidates/bulk/notes', { candidate_ids: ids, text: text.trim() })
      .then((res) => {
        const n = Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length
        notifyOutcome('bulk.noteAdded', {}, n, ids.length)
      })
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }

  // Bulk-merge modal state (punt 4) — set once exactly 2 candidates are selected
  // and the recruiter picks "Samenvoegen…" from the bulk-actions menu.
  const [bulkMergeTarget, setBulkMergeTarget] = useState<BulkMergeTarget | null>(null)

  // Prompt the merge modal for the two selected rows — CandidatesBulkBar only shows
  // the menu entry when selectedIds.size === 2, this is the defensive re-check.
  // [...selectedIds] preserves insertion (= click) order, so "first selected" is stable.
  const bulkMergePrompt = () => {
    const ids = [...selectedIds]
    if (ids.length !== 2) return
    const byId = new Map(candidates.map(c => [c.id, c]))
    const first = byId.get(ids[0]); const second = byId.get(ids[1])
    if (!first || !second) return
    const toLite = (c: Candidate): BulkMergeLite => ({ id: c.id, name: c.name, code: c.referenceNumber, email: c.email })
    setBulkMergeTarget({ current: toLite(first), other: toLite(second) })
  }
  // The modal's onMerged callback: close it and clear the selection (punt 4 —
  // the survivor reopens fresh via the page's own onMerged handler).
  const resolveBulkMerge = () => { setBulkMergeTarget(null); setSelectedIds(new Set()) }

  // Archive-guard modal state (§3B) — set when the pre-check (or a 409 from the
  // actual call) finds candidates with a live application/active match.
  const [bulkArchiveGuard, setBulkArchiveGuard] = useState<BulkArchiveGuardTarget | null>(null)

  // The actual bulk archive call — also re-used once the guard modal resolves
  // every blocker. A 409 with the forward-compat `{ live }` payload re-opens the
  // guard (whole-selection aggregate) instead of a bare error toast.
  const runBulkArchive = (ids: Id[]) => {
    api.post('/candidates/bulk/archive', { candidate_ids: ids })
      .then((res) => {
        const archived: Id[] = Array.isArray(res.data?.archived) ? res.data.archived : ids
        const set = new Set(archived)
        setCandidates(prev => prev.filter(c => !set.has(c.id)))
        setTotal(tt => Math.max(0, tt - archived.length))
        notifyOutcome('bulk.archived', {}, archived.length, ids.length)
      })
      .catch((e) => {
        const live = liveFromError(e)
        if (live) { setBulkArchiveGuard({ ids, blockedCount: ids.length, totalCount: ids.length, ...live }); return }
        notify('error', t('bulk.archiveError'))
      })
  }

  // Archive (soft-delete) the selection. Pre-checks the (row-flagged, capped)
  // subset for live applications/matches first; any blocked candidate opens the
  // guard modal in aggregate mode instead of the plain confirm dialog.
  const bulkArchive = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    const byId = new Map(candidates.map(c => [c.id, c]))
    const risky = ids.filter(id => needsLiveCheck(byId.get(id), funnelTypes))
    const toCheck = risky.slice(0, BULK_GUARD_CHECK_CAP)
    const checks = await Promise.all(toCheck.map(async id => ({ id, blockers: await fetchLiveBlockers(id) })))
    const blocked = checks.filter(c => c.blockers.applications.length || c.blockers.matches.length)
    if (blocked.length) {
      const name = (id: Id) => byId.get(id)?.name
      setBulkArchiveGuard({
        ids, blockedCount: blocked.length, totalCount: ids.length,
        applications: blocked.flatMap(b => b.blockers.applications.map(a => ({ ...a, candidateName: name(b.id) }))),
        matches: blocked.flatMap(b => b.blockers.matches.map(m => ({ ...m, candidateName: name(b.id) }))),
      })
      return
    }
    confirm(t('bulk.archiveConfirm', { count: ids.length }), () => runBulkArchive(ids), { danger: true })
  }

  // The modal's primary action: every blocker resolved → run the real bulk archive.
  const resolveBulkArchiveGuard = () => {
    if (!bulkArchiveGuard) return
    const { ids } = bulkArchiveGuard
    setBulkArchiveGuard(null)
    runBulkArchive(ids)
  }

  // Convert the selection to a phase (e.g. Lead→Kandidaat). The backend validates
  // each candidate against that phase's required fields; incomplete ones are skipped
  // (reconciled back via bulkMutate) → "X van Y gelukt" (warning when any skipped).
  const bulkConvertPhase = (phase: string) => {
    const total = selectedIds.size
    bulkMutate({
      url: '/candidates/bulk/phase', body: { phase },
      patch: { phase }, keys: ['phase'],
      onSuccess: (n) => notify(n < total ? 'warning' : 'success', t('bulk.convertResult', { updated: n, total })),
    })
  }
  // AXIS-MATRIX-2 N2 (docs/AXIS-MATRIX.md "Niet-interactieve contexten"): one
  // summary preflight BEFORE a guarded bulk mutation runs, so a recruiter sees
  // "{n} of {m} will be skipped" up front instead of only in the after-the-fact
  // partial-result toast. Of every candidate bulk mutation, `candidate.status_set`
  // is the ONLY one with a real action-rules catalog entry (CandidateBulkService::
  // status already re-checks the SAME guard server-side and skips blocked rows —
  // this call never invents a second source of truth, it just previews it). The
  // other bulk actions here (owner/phase/candidate-type/tags/notes/archive/consent)
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
        const reasons = breakdown.filter(g => g.effect === 'block')
          .map(g => `${g.count} ${axisConditionLabel(g.condition)}`).join(', ')
        const proceed = total - blocked
        if (proceed <= 0) { notify('warning', t('bulk.statusAllBlocked', { total, reasons })); return }
        confirm(t('bulk.statusBlockedConfirm', { blocked, total, reasons, proceed }), () => runBulkSetStatus(status, label))
      })
      // The preflight is a courtesy preview, not a gate — a network hiccup or a
      // permission read-gap must never block the actual (still server-enforced) action.
      .catch(() => runBulkSetStatus(status, label))
  }
  // Add a tag to the selection (mirror of bulkRemoveTag).
  const bulkAddTag = (tag: string) => {
    const ids = [...selectedIds]
    const tg = tag.trim()
    if (!ids.length || !tg) return
    const changedIds = candidates.filter(c => ids.includes(c.id) && !(c.tags ?? []).includes(tg)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tg] } : c))
    api.post('/candidates/bulk/tags/add', { candidate_ids: ids, tag: tg })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !updated.has(c.id)) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tg) } : c))
        notifyOutcome('bulk.tagAdded', { tag: tg }, updated ? updated.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tg) } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  // Set channel consent (AVG opt-in) for the selection. No optimistic row patch —
  // consent isn't a list column; the server stamps `*_consent_at` on a flip.
  const bulkSetConsent = (consent: Record<string, boolean>, label: string) => bulkMutate({
    url: '/candidates/bulk/consent', body: { consent },
    patch: {}, keys: [],
    onSuccess: (n, total) => notifyOutcome('bulk.consentChanged', { value: label }, n, total),
  })

  return {
    toggleRow, toggleAll, bulkAddToPool, bulkRemoveFromPool,
    bulkSetOwner, bulkSetStage, bulkSetTypes, bulkSetConsent, bulkConvertPhase, bulkSetStatus, bulkAddTag,
    selectedTags, bulkRemoveTag, bulkAddNote, bulkArchive,
    bulkArchiveGuard, setBulkArchiveGuard, resolveBulkArchiveGuard,
    bulkMergeTarget, bulkMergePrompt, resolveBulkMerge,
    dialog,
  }
}
