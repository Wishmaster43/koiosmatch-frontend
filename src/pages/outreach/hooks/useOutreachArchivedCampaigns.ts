/**
 * useOutreachArchivedCampaigns — lazily fetches the soft-deleted campaigns
 * (archived + pending-erase/trash) once either quick view is opened, and
 * exposes a lifecycle reader plus a manual refetch bump for post-mutation
 * refresh. Extracted from OutreachPage.tsx (§0.3 size split).
 *
 * OUTREACH-TRASHED-1 (fixed, measured): the backend takes `?archived=1` as a
 * true onlyTrashed filter (mirrors tasks), so the archived list comes
 * straight from the server — no client-side subtraction against the active ids.
 */
import { useEffect, useState } from 'react'
import { listCampaigns } from '../data/outreachApi'
import type { Campaign } from './useOutreachCampaigns'

// Fetches the soft-deleted campaigns while either the archived or trash view
// is open, refetching whenever `refetchArchived()` bumps the internal tick
// (e.g. after a mark/unmark elsewhere on the page, TRASH-OVERAL-2).
export function useOutreachArchivedCampaigns(showArchived: boolean, showTrash: boolean) {
  const [archivedRaw, setArchivedRaw] = useState<Campaign[]>([])
  const [archLoading, setArchLoading] = useState(false)
  const [archError, setArchError] = useState(false)
  const [tick, setTick] = useState(0)

  // Lazily fetch the soft-deleted campaigns only once the archived/trash view is
  // opened; `tick` bumps to refetch after a mark/unmark elsewhere on the page.
  useEffect(() => {
    if (!showArchived && !showTrash) return
    let alive = true
    setArchLoading(true); setArchError(false)
    listCampaigns({ archived: 1 })
      .then((res) => { if (alive) setArchivedRaw((res.rows as Campaign[]) ?? []) })
      .catch(() => { if (alive) setArchError(true) })
      .finally(() => { if (alive) setArchLoading(false) })
    return () => { alive = false }
  }, [showArchived, showTrash, tick])

  // Soft-deleted rows, exactly as the server returned them (each already carries
  // `archived`/`deleted_at`/`lifecycle` from OutreachCampaignResource). Tolerant
  // lifecycle read for payloads that predate the field (TRASH-OVERAL-2).
  const lifecycleOf = (c?: Campaign) => c?.lifecycle ?? (c?.deleted_at || c?.archived ? 'archived' : 'active')

  // Enkelstuks-sweep restore (BE 9170e40): drop the restored row from the
  // archived list optimistically, instead of waiting on a full refetch.
  const removeArchived = (id: string) => setArchivedRaw((prev) => prev.filter((c) => c.id !== id))

  return {
    archived: archivedRaw, archLoading, archError, lifecycleOf,
    refetchArchived: () => setTick((v) => v + 1),
    removeArchived,
  }
}
