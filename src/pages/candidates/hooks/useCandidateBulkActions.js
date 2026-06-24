/**
 * useCandidateBulkActions — the bulk operations for CandidatesPage: row/all
 * selection toggles, pool add/remove, owner/stage/type mutations, tag removal,
 * note add and archive. Each mutation is optimistic, persists, then reconciles
 * against the server's `updated`/`added`/`removed` list (reverts on failure).
 * Selection state + the toast `notify` live in the container and are passed in.
 */
import { useMemo } from 'react'
import api from '@/lib/api'
import { metaOf, initialsOf } from '../data/candidatesShared'

export function useCandidateBulkActions({
  candidates, setCandidates, setTotal, selectedIds, setSelectedIds, notify, t, funnelTypes, candidateTypes,
}) {
  // ── Bulk selection ──
  const toggleRow = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = (ids, allSelected) => setSelectedIds(prev => {
    const next = new Set(prev)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    return next
  })

  // Add the selection to a pool: patch the pool column optimistically, persist,
  // and revert + warn on failure (only candidates lacking the pool change).
  const bulkAddToPool = (pool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && !(c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
    api.post(`/pools/${poolId}/candidates`, { candidate_ids: ids })
      .then((res) => {
        const added = Array.isArray(res.data?.added) ? new Set(res.data.added) : null
        if (added) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !added.has(c.id))
          ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notify('success', t('bulk.addedToPool', { pool: pool.name, count: added ? added.size : changedIds.length }))
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }
  // Remove the selection from a pool: same optimistic + revert pattern.
  const bulkRemoveFromPool = (pool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
    api.delete(`/pools/${poolId}/candidates`, { data: { candidate_ids: ids } })
      .then((res) => {
        const removed = Array.isArray(res.data?.removed) ? new Set(res.data.removed) : null
        if (removed) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !removed.has(c.id))
          ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notify('success', t('bulk.removedFromPool', { pool: pool.name, count: removed ? removed.size : changedIds.length }))
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }

  // Snapshot a subset of fields, for optimistic revert/reconcile.
  const subsetOf = (obj, keys) => keys.reduce((a, k) => { a[k] = obj[k]; return a }, {})

  // Generic optimistic bulk field mutation: apply `patch` to the selected rows,
  // persist, reconcile against the server's `updated` list, revert on failure.
  const bulkMutate = ({ url, body, patch, keys, onSuccess }) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const snap = new Map(candidates.filter(c => ids.includes(c.id)).map(c => [c.id, subsetOf(c, keys)]))
    setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...patch } : c))
    api.post(url, { candidate_ids: ids, ...body })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (ids.includes(c.id) && !updated.has(c.id)) ? { ...c, ...snap.get(c.id) } : c))
        onSuccess(updated ? updated.size : ids.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...snap.get(c.id) } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }
  // Change the owner/recruiter for the selection.
  const bulkSetOwner = (user) => bulkMutate({
    url: '/candidates/bulk/owner', body: { owner_id: user.id },
    patch: { owner: user.name, ownerId: user.id, ownerInitials: initialsOf(user.name), ownerColor: undefined },
    keys: ['owner', 'ownerId', 'ownerInitials', 'ownerColor'],
    onSuccess: (n) => notify('success', t('bulk.ownerChanged', { name: user.name, count: n })),
  })
  // Move the selection to a funnel stage.
  const bulkSetStage = (stage) => bulkMutate({
    url: '/candidates/bulk/funnel-stage', body: { funnel_type: stage },
    patch: { stage }, keys: ['stage'],
    onSuccess: (n) => notify('success', t('bulk.stageChanged', { value: metaOf(funnelTypes, stage)?.label ?? stage, count: n })),
  })
  // Set the EXACT candidate-type set for the selection (multi-select add/remove).
  // An empty set clears all types — so an unused type can then be deleted in Settings.
  const bulkSetTypes = (types) => bulkMutate({
    url: '/candidates/bulk/candidate-type', body: { candidate_types: types },
    patch: { candidateTypes: types }, keys: ['candidateTypes'],
    onSuccess: (n) => notify('success', t('bulk.typeChanged', {
      value: types.length ? types.map(v => metaOf(candidateTypes, v)?.label ?? v).join(', ') : t('bulk.noneLabel'),
      count: n,
    })),
  })

  // Union of tags across the selected candidates — the "remove tag" option list.
  const selectedTags = useMemo(() => {
    const set = new Set()
    candidates.forEach(c => { if (selectedIds.has(c.id)) (c.tags ?? []).forEach(tg => set.add(tg)) })
    return [...set]
  }, [candidates, selectedIds])

  // Remove a tag from every selected candidate that has it (optimistic + reconcile).
  const bulkRemoveTag = (tag) => {
    const ids = [...selectedIds]
    if (!ids.length || !tag) return
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.tags ?? []).includes(tag)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: (c.tags ?? []).filter(x => x !== tag) } : c))
    api.post('/candidates/bulk/tags/remove', { candidate_ids: ids, tag })
      .then((res) => {
        const updated = Array.isArray(res.data?.updated) ? new Set(res.data.updated) : null
        if (updated) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !updated.has(c.id)) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notify('success', t('bulk.tagRemoved', { tag, count: updated ? updated.size : changedIds.length }))
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, tags: [...(c.tags ?? []), tag] } : c))
        notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  // Add the same note to every selected candidate (no table column → toast only).
  const bulkAddNote = (text) => {
    const ids = [...selectedIds]
    if (!ids.length || !text.trim()) return
    api.post('/candidates/bulk/notes', { candidate_ids: ids, text: text.trim() })
      .then((res) => {
        const n = Array.isArray(res.data?.updated) ? res.data.updated.length : ids.length
        notify('success', t('bulk.noteAdded', { count: n }))
      })
      .catch(() => notify('error', t('bulk.mutateError')))
    setSelectedIds(new Set())
  }

  // Archive (soft-delete) the selection. Confirmation first; rows drop only once
  // the server confirms. Authorization is UI-gated here and re-checked server-side.
  const bulkArchive = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(t('bulk.archiveConfirm', { count: ids.length }))) return
    api.post('/candidates/bulk/archive', { candidate_ids: ids })
      .then((res) => {
        const archived = Array.isArray(res.data?.archived) ? res.data.archived : ids
        const set = new Set(archived)
        setCandidates(prev => prev.filter(c => !set.has(c.id)))
        setTotal(tt => Math.max(0, tt - archived.length))
        notify('success', t('bulk.archived', { count: archived.length }))
      })
      .catch(() => notify('error', t('bulk.archiveError')))
    setSelectedIds(new Set())
  }

  return {
    toggleRow, toggleAll, bulkAddToPool, bulkRemoveFromPool,
    bulkSetOwner, bulkSetStage, bulkSetTypes, selectedTags, bulkRemoveTag, bulkAddNote, bulkArchive,
  }
}
