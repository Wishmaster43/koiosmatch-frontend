/**
 * useOpportunityArchive — the per-record archive/restore lifecycle for one deal.
 * DELETE /opportunities/{id} + POST /opportunities/{id}/restore already existed
 * before the 2026-07-17/18 sweep (the commit message for the matches/outreach
 * delivery lists opportunities among the entities that "already had them") — this
 * hook is new FE wiring for pre-existing BE routes, not a new BE contract. Gated
 * server-side by DIFFERENT permissions per route (grepped
 * routes/api/tenant/opportunities.php): destroy needs opportunities.delete,
 * restore needs the looser opportunities.update — the page passes onArchive/
 * onRestore accordingly, never a single combined flag. Enkelstuks: the per-id
 * route, never bulk-with-one-id (there IS a bulk/archive route, C-41, but a
 * single record uses its own DELETE, mirroring candidates BE 5970c03).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notify } from '@/lib/notify'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

interface Args {
  // Patch the row/selected copy (reuses useOpportunitiesData.updateOpportunity —
  // 'archived'/'archivedAt' aren't in its recognized-key list, so this only
  // updates local state and never fires a stray PATCH).
  onPatch: (id: Id | undefined, patch: Partial<Opportunity>) => void
  // Refetch the list so an archived row drops out / a restored one comes back
  // (the default query already excludes soft-deleted rows — no client filter needed).
  onReload: () => void
}

export function useOpportunityArchive({ onPatch, onReload }: Args) {
  const { t } = useTranslation('opportunities')
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // DELETE /opportunities/{id} — reversible soft-delete, no extra guard server-side.
  const archiveOpportunity = async (id: Id | undefined) => {
    if (id == null || archiving) return
    if (!window.confirm(t('drawer.archiveConfirm'))) return
    setArchiving(true)
    try {
      await api.delete(`/opportunities/${id}`)
      onPatch(id, { archived: true, archivedAt: new Date().toISOString() })
      onReload()
      notify('success', t('drawer.archived'))
    } catch {
      notify('error', t('drawer.archiveFailed'))
    } finally {
      setArchiving(false)
    }
  }

  // POST /opportunities/{id}/restore — un-archive. The response is only
  // `{ restored: true }` (no fresh detail, unlike matches) — clearing the two
  // local flags is all the drawer needs (mirrors VacancyDrawer's restoreVacancy).
  const restoreOpportunity = async (id: Id | undefined) => {
    if (id == null || restoring) return
    setRestoring(true)
    try {
      await api.post(`/opportunities/${id}/restore`)
      onPatch(id, { archived: false, archivedAt: null })
      onReload()
      notify('success', t('drawer.archivedBanner.restored'))
    } catch {
      notify('error', t('drawer.archivedBanner.restoreFailed'))
    } finally {
      setRestoring(false)
    }
  }

  return { archiveOpportunity, restoreOpportunity, archiving, restoring }
}
