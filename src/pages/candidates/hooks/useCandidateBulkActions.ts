/**
 * useCandidateBulkActions — the bulk operations for CandidatesPage: row/all
 * selection toggles, owner/type mutations, and the generic optimistic
 * `bulkMutate`/`notifyOutcome` machinery shared by every cluster. Selection
 * state + the toast `notify` live in the container and are passed in.
 *
 * Every other cluster (§3 size split, > ~400-line trigger) lives in its own
 * sibling hook and is composed below so its public API stays identical:
 * - `useCandidateStageBulk` — funnel/phase/status + the AXIS-MATRIX-2 N2 bulk preflight.
 * - `useCandidateAsyncBulk` — the queued/async pair (`bulkGeocode`/`bulkCoupleBackoffice`).
 * - `useCandidatePoolBulk` — pool add/remove.
 * - `useCandidateTagBulk` — tag add/remove + the selected-tags union.
 * - `useCandidateNoteBulk` — bulk note add.
 * - `useCandidateArchiveBulk` — the archive-guard pre-check + bulk archive.
 * - `useCandidateMergeBulk` — the 2-row bulk-merge prompt.
 * `bulkMutate`/`notifyOutcome` are built here and passed into every cluster that
 * needs them, so there is exactly one implementation of each.
 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { metaOf, initialsOf } from '../data/candidatesShared'
import { useConfirm } from '@/hooks/useConfirm'
import { useNavigation } from '@/context/NavigationContext'
import { useCandidateStageBulk } from './useCandidateStageBulk'
import { useCandidateAsyncBulk } from './useCandidateAsyncBulk'
import { useCandidatePoolBulk } from './useCandidatePoolBulk'
import { useCandidateTagBulk } from './useCandidateTagBulk'
import { useCandidateNoteBulk } from './useCandidateNoteBulk'
import { useCandidateArchiveBulk } from './useCandidateArchiveBulk'
import { useCandidateMergeBulk } from './useCandidateMergeBulk'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

// Re-exported so CandidateLifecycleModals (and any other outside caller) keeps
// importing these two types from this file's own path unchanged.
export type { BulkArchiveGuardTarget } from './useCandidateArchiveBulk'
export type { BulkMergeLite, BulkMergeTarget } from './useCandidateMergeBulk'

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
  // BULK-FILTERSET-1: the server-side filter params of the currently visible list
  // (same shape the list query sends, §3 useCandidateFilters) and the honest
  // server-reported total they match — both required to offer the "all N filtered
  // results" scope. Optional so existing callers/tests keep compiling unchanged;
  // the filtered scope is simply unavailable (never offered) without them.
  filterParams?: Record<string, unknown>
  filteredTotal?: number
  // Called once a filtered-scope mutation succeeds, so the caller can refetch the
  // list (rows outside the loaded page changed — no optimistic patch is possible
  // without fabricating state for candidates never fetched).
  onFilteredMutated?: () => void
}

// BULK-FILTERSET-1: the bulk bar's selection mode — either the checked rows
// (today's only mode, ids-based) or the ENTIRE active filter set (server-side,
// same query the list page itself runs). The two are mutually exclusive (XOR
// on the request body, matches the backend contract) — never sent together.
export type BulkScope = 'selected' | 'filtered'

// Exported so useCandidateStageBulk (the extracted funnel/phase/status cluster)
// can type the `bulkMutate` function it receives without a second declaration.
export interface BulkMutateArgs {
  url: string
  body?: Record<string, unknown>
  patch: Partial<Candidate>
  keys: Array<keyof Candidate>
  // Job 42: called with (updated, total) so every caller can surface an honest
  // partial-failure summary instead of a bare "success" that hides a skip.
  // BULK-SKIP-REASONS-1: also forwards the raw `skipped` array so the funnel/phase
  // callers (the only two endpoints that return the reasoned [{id,reason}] shape)
  // can build a "why" breakdown — every other caller ignores this 3rd argument.
  onSuccess: (updated: number, total: number, skipped?: unknown[]) => void
}

// Bulk-mutation handlers for the candidates table (funnel/phase/type/…), reporting an updated/total/skipped breakdown so a partial failure never reads as a bare success.
export function useCandidateBulkActions({
  candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes,
  filterParams, filteredTotal, onFilteredMutated,
}: UseCandidateBulkActionsParams) {
  const { confirm, dialog } = useConfirm()
  // BULK-FILTERSET-1: which rows a bulk action targets — resets to 'selected'
  // whenever the checked selection is cleared (CandidatesToolbar's deselect),
  // so a stale "all filtered" choice never survives a fresh selection.
  const [bulkScope, setBulkScope] = useState<BulkScope>('selected')
  const resetBulkScope = () => setBulkScope('selected')
  // 11.1: the shared cross-entity navigate — powers the funnel bulk-node's
  // "manage per application" deep-link (mirrors EntityLink's use of the same context).
  const { navigate } = useNavigation()
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

  // BULK-FILTERSET-1: the filtered-scope branch of bulkMutate below. The backend
  // XORs the body — either `ids` or `filters`, never both — and 422s an empty
  // filter set (never a silent "everything"), so this refuses to call the API
  // when there is nothing narrowing the list. No optimistic patch is possible
  // (the mutation reaches rows outside the loaded page), so on success the
  // caller's `onFilteredMutated` refetch is the only source of truth — and the
  // count shown to the recruiter beforehand (`filteredTotal`) is the same
  // server-reported total the list page itself renders, never guessed.
  const bulkMutateFiltered = ({ url, body, onSuccess }: BulkMutateArgs) => {
    const filters = filterParams ?? {}
    if (!Object.keys(filters).length) { notify('error', t('bulk.emptyFilterError')); return }
    const total = filteredTotal ?? 0
    confirm(t('bulk.filteredConfirm', { count: total }), () => {
      api.post(url, { filters, ...body })
        .then((res) => {
          const updated = typeof res.data?.updated === 'number' ? res.data.updated
            : Array.isArray(res.data?.updated) ? res.data.updated.length : total
          onSuccess(updated, total, Array.isArray(res.data?.skipped) ? res.data.skipped : undefined)
          onFilteredMutated?.()
        })
        .catch((e) => {
          // A dedicated upper-bound response (backend caps the filtered bulk instead
          // of silently truncating it) surfaces its own readable message; anything
          // else falls back to the generic mutate error.
          if (e?.response?.status === 422 && e.response?.data?.code === 'bulk_limit_exceeded') {
            notify('error', t('bulk.limitExceeded', { limit: e.response.data.limit ?? '' }))
          } else {
            notify('error', t('bulk.mutateError'))
          }
        })
    }, { danger: true })
    resetBulkScope()
  }

  // Generic optimistic bulk field mutation: apply `patch` to the selected rows,
  // persist, reconcile against the server's `updated` list, revert on failure.
  // BULK-FILTERSET-1: when `bulkScope` is 'filtered', delegates to the filters-body
  // branch above instead — the two request shapes are mutually exclusive (XOR),
  // so this never sends `candidate_ids` and `filters` together.
  const bulkMutate = (args: BulkMutateArgs) => {
    if (bulkScope === 'filtered') { bulkMutateFiltered(args); return }
    const { url, body, patch, keys, onSuccess } = args
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(candidates.filter(c => ids.includes(c.id)).map(c => [c.id, subsetOf(c, keys)]))
    setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...patch } : c))
    api.post(url, { candidate_ids: ids, ...body })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (ids.includes(c.id) && !updated.has(c.id)) ? { ...c, ...snap.get(c.id) } : c))
        // BULK-SKIP-REASONS-1: forward the raw `skipped` array too — funnel/phase read
        // it for the reason breakdown; every other caller ignores this 3rd argument.
        onSuccess(updated ? updated.size : ids.length, ids.length, Array.isArray(res.data?.skipped) ? res.data.skipped : undefined)
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
  // 11.1: convenience deep-link from the funnel bulk-node to the Applications page,
  // carrying the current selection via the shared NavigationContext intent pattern
  // (mirrors a KPI/chart click seeding a filter on arrival). The axis-correct bulk
  // home for funnel stage stays PER-APPLICATION (ApplicationsBulkBar) — this just
  // gets the recruiter there with the right candidates in view. ApplicationsPage
  // reads the `candidate_ids` intent key and sends it on to the server as a
  // `candidate_ids` filter param (see useApplicationFilters) — until the backend
  // ApplicationQuery accepts that filter, the list shows everything unfiltered
  // (honest: no client-only scope that would silently disagree with the server's
  // unfiltered pagination totals) while a chip shows the scope is active + clearable.
  const manageByApplication = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    navigate('applications', { candidate_ids: ids })
  }
  // Set the EXACT candidate-type set for the selection (multi-select add/remove).
  // An empty set clears all types — so an unused type can then be deleted in Settings.
  const bulkSetTypes = (types: string[]) => bulkMutate({
    url: '/candidates/bulk/candidate-type', body: { candidate_types: types },
    patch: { candidateTypes: types }, keys: ['candidateTypes'],
    onSuccess: (n, total) => notifyOutcome('bulk.typeChanged', {
      value: types.length ? types.map(v => metaOf(candidateTypes, v)?.label ?? v).join(', ') : t('bulk.noneLabel'),
    }, n, total),
  })

  // Pool/tag/note/archive-guard/merge clusters (§3 size split) — each lives in
  // its own sibling hook; bulkMutate/notifyOutcome are shared in so there is
  // exactly one implementation of each. Every returned function is re-exported
  // below unchanged, so CandidatesPage/CandidatesBulkBar never notice the split.
  const { bulkAddToPool, bulkRemoveFromPool } = useCandidatePoolBulk({
    candidates, setCandidates, selectedIds, setSelectedIds, notify, t, notifyOutcome,
  })
  const { selectedTags, bulkAddTag, bulkRemoveTag } = useCandidateTagBulk({
    candidates, setCandidates, selectedIds, setSelectedIds, notify, t, notifyOutcome,
  })
  const { bulkAddNote } = useCandidateNoteBulk({ selectedIds, setSelectedIds, notify, t, notifyOutcome })
  const { bulkArchive, bulkArchiveGuard, setBulkArchiveGuard, resolveBulkArchiveGuard } = useCandidateArchiveBulk({
    candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, confirm, notifyOutcome,
  })
  const { bulkMergeTarget, bulkMergePrompt, resolveBulkMerge } = useCandidateMergeBulk({ candidates, selectedIds, setSelectedIds })

  // Funnel/phase/status cluster (§3 size split) — bulkSetStage/bulkConvertPhase/
  // bulkSetStatus + the AXIS-MATRIX-2 N2 bulk preflight now live in their own hook;
  // bulkMutate/notifyOutcome are passed in so there is exactly one implementation
  // of each. The three returned functions are re-exported below unchanged.
  const { bulkSetStage, bulkConvertPhase, bulkSetStatus } = useCandidateStageBulk({
    selectedIds, notify, t, funnelTypes, confirm, bulkMutate, notifyOutcome,
  })

  // Set channel consent (AVG opt-in) for the selection. No optimistic row patch —
  // consent isn't a list column; the server stamps `*_consent_at` on a flip.
  const bulkSetConsent = (consent: Record<string, boolean>, label: string) => bulkMutate({
    url: '/candidates/bulk/consent', body: { consent },
    patch: {}, keys: [],
    onSuccess: (n, total) => notifyOutcome('bulk.consentChanged', { value: label }, n, total),
  })

  // Queued/async cluster (§3 size split) — bulkGeocode (GEO-REGEOCODE-1) and
  // bulkCoupleBackoffice (SYNC-BULK-1) share the same fire-and-forget shape (no
  // optimistic patch, no `updated`-list reconcile); both now live in their own
  // hook and are re-exported below unchanged.
  const { bulkGeocode, bulkCoupleBackoffice } = useCandidateAsyncBulk({ selectedIds, setSelectedIds, notify, t, candidates })

  return {
    toggleRow, toggleAll, bulkAddToPool, bulkRemoveFromPool,
    bulkSetOwner, bulkSetStage, bulkSetTypes, bulkSetConsent, bulkConvertPhase, bulkSetStatus, bulkAddTag,
    selectedTags, bulkRemoveTag, bulkAddNote, bulkArchive, manageByApplication, bulkGeocode, bulkCoupleBackoffice,
    bulkArchiveGuard, setBulkArchiveGuard, resolveBulkArchiveGuard,
    bulkMergeTarget, bulkMergePrompt, resolveBulkMerge,
    // BULK-FILTERSET-1: the ids-vs-filters scope toggle for the generic bulkMutate
    // actions (owner, type, consent, funnel/phase/status) — CandidatesBulkBar reads
    // it to render the "all N filtered results" choice and its confirm count.
    bulkScope, setBulkScope, resetBulkScope, filteredTotal: filteredTotal ?? 0,
    dialog,
  }
}
