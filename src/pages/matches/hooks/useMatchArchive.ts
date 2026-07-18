/**
 * useMatchArchive — the per-record archive/restore lifecycle for one match
 * (BE sweep, 2026-07-17/18): DELETE /matches/{id} already existed
 * (MATCH-PLACEMENT-1 fase 4); POST /matches/{id}/restore is new (commit 9170e40,
 * "every soft-delete entity now carries its own DELETE/{id} + restore pair").
 * Enkelstuks: the per-id route, never bulk-with-one-id (mirrors candidates,
 * BE 5970c03) — matches never had a bulk-archive route to begin with. Both routes
 * are gated by matches.update server-side, so the page only wires onArchive/
 * onRestore when the user actually has that permission (never a disabled-but-
 * present affordance). List-level archived VISIBILITY (toggle/chip) is now covered
 * too (MATCH-ARCHIVED-LIST-1 — see useMatches); this hook only covers the
 * single-record action reachable from an already-open drawer.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notify } from '@/lib/notify'
import type { MatchRow } from '@/types/match'

interface Args {
  // Patch the row/selected copy (MatchesPage.patchRow) for instant banner feedback.
  onPatch: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // Refetch the list so an archived row drops out / a restored one comes back
  // (the default query already excludes soft-deleted rows — no client filter needed).
  onReload: () => void
}

export function useMatchArchive({ onPatch, onReload }: Args) {
  const { t } = useTranslation('matches')
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // DELETE /matches/{id} — reversible soft-delete. The backend refuses with 409
  // while the placement's HelloFlex contract is still active (end it first) —
  // surfaced as its own message rather than the generic failure toast.
  const archiveMatch = async (id: MatchRow['id']) => {
    if (id == null || archiving) return
    if (!window.confirm(t('drawer.archiveConfirm'))) return
    setArchiving(true)
    try {
      await api.delete(`/matches/${id}`)
      onPatch(id, { archived: true, archivedAt: new Date().toISOString() })
      onReload()
      notify('success', t('drawer.archived'))
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      notify('error', status === 409 ? t('drawer.archiveBlockedActiveContract') : t('drawer.archiveFailed'))
    } finally {
      setArchiving(false)
    }
  }

  // POST /matches/{id}/restore — un-archive. The response carries the fresh
  // detail (MatchController::restore returns via show()), but clearing the two
  // local flags is all the drawer needs (mirrors VacancyDrawer's restoreVacancy) —
  // the reload brings the row back into the table with its real, server-side data.
  const restoreMatch = async (id: MatchRow['id']) => {
    if (id == null || restoring) return
    setRestoring(true)
    try {
      await api.post(`/matches/${id}/restore`)
      onPatch(id, { archived: false, archivedAt: null })
      onReload()
      notify('success', t('drawer.archivedBanner.restored'))
    } catch {
      notify('error', t('drawer.archivedBanner.restoreFailed'))
    } finally {
      setRestoring(false)
    }
  }

  return { archiveMatch, restoreMatch, archiving, restoring }
}
