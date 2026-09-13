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
 * single record uses its own DELETE, mirroring candidates BE 5970c03). Thin
 * wrapper around the shared useEntityArchive factory (DRY round).
 */
import { useEntityArchive } from '@/hooks/useEntityArchive'
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
  const { archive, restore, archiving, restoring, dialog } = useEntityArchive<Id | undefined>({
    resource: 'opportunities', namespace: 'opportunities', onPatch, onReload,
  })
  return { archiveOpportunity: archive, restoreOpportunity: restore, archiving, restoring, dialog }
}
