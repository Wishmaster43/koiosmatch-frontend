/**
 * useOpportunityTextPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): the
 * "Kanstekst" gets the profile-text second-screen recipe, mirrored 1:1 from
 * useMatchTextPopout — a light identity fetch for the popped-out window plus
 * a standalone PATCH /opportunities/{id} on the SAME `description` field the
 * drawer's own OpportunityDescriptionBlock writes (via DetailsTab's onUpdate,
 * see useOpportunitiesData.updateOpportunity's `'description' in patch` line).
 */
import { useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { hasDescriptionText } from '../data/descriptionText'
import { useLiteRecord } from '@/hooks/useLiteRecord'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface OpportunityTextLite { id: string; title: string; initials: string; description: string }

// The subset of the raw opportunity resource this popout actually reads.
interface RawOpportunityLite {
  id?: Id
  title?: string
  name?: string
  description?: string | null
}

// Mapper: fetch and build the OpportunityTextLite from the raw response.
function mapOpportunityTextLite(raw: RawOpportunityLite, id: string): OpportunityTextLite {
  const title = raw.title ?? raw.name ?? '?'
  return {
    id: String(raw.id ?? id),
    title,
    initials: initialsOf(title),
    description: raw.description ?? ''
  }
}

// Light identity fetch for the popped-out opportunity-text window.
export function useOpportunityTextLite(id: string | undefined) {
  // Fetch and map in one stable callback so useLiteRecord's effect stays single-run per id.
  const fetchRecord = useCallback(
    (opportunityId: string) => api.get(`/opportunities/${opportunityId}`).then(r => {
      const raw = unwrap<RawOpportunityLite>(r)
      return mapOpportunityTextLite(raw, opportunityId)
    }),
    []
  )
  const { record: opportunity, loading, error, reload } = useLiteRecord(id, fetchRecord)
  return { opportunity, loading, error, reload }
}

// Standalone PATCH /opportunities/{id} — same field OpportunityDescriptionBlock
// writes through DetailsTab's onUpdate. Reuses hasDescriptionText (§11 — one
// helper, not a copy) so a TipTap empty-paragraph artifact ('<p></p>') clears
// to null here too, not only in the drawer's own save path.
export function patchOpportunityText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/opportunities/${id}`, { description: hasDescriptionText(html) ? html : null })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
