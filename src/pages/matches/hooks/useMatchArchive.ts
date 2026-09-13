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
 * single-record action reachable from an already-open drawer. Thin wrapper
 * around the shared useEntityArchive factory (DRY round, adds the 409 "active
 * contract" message matches alone needs on archive failure).
 */
import { useEntityArchive } from '@/hooks/useEntityArchive'
import type { MatchRow } from '@/types/match'
import { useTranslation } from 'react-i18next'

interface Args {
  // Patch the row/selected copy (MatchesPage.patchRow) for instant banner feedback.
  onPatch: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // Refetch the list so an archived row drops out / a restored one comes back
  // (the default query already excludes soft-deleted rows — no client filter needed).
  onReload: () => void
}

export function useMatchArchive({ onPatch, onReload }: Args) {
  const { t } = useTranslation('matches')
  // The backend refuses with 409 while the match's HelloFlex contract is still
  // active (end it first) — surfaced as its own message rather than the generic one.
  const { archive, restore, archiving, restoring, dialog } = useEntityArchive<MatchRow['id']>({
    resource: 'matches', namespace: 'matches', onPatch, onReload,
    mapArchiveError: (e) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      return status === 409 ? t('drawer.archiveBlockedActiveContract') : null
    },
  })
  return { archiveMatch: archive, restoreMatch: restore, archiving, restoring, dialog }
}
