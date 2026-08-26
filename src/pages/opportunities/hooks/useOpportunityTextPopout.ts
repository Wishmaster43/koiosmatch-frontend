/**
 * useOpportunityTextPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): the
 * "Kanstekst" gets the profile-text second-screen recipe, mirrored 1:1 from
 * useMatchTextPopout — a light identity fetch for the popped-out window plus
 * a standalone PATCH /opportunities/{id} on the SAME `description` field the
 * drawer's own OpportunityDescriptionBlock writes (via DetailsTab's onUpdate,
 * see useOpportunitiesData.updateOpportunity's `'description' in patch` line).
 */
import { useCallback, useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { hasDescriptionText } from '../data/descriptionText'
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

// Light identity fetch for the popped-out opportunity-text window.
export function useOpportunityTextLite(id: string | undefined) {
  const [opportunity, setOpportunity] = useState<OpportunityTextLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetches the opportunity's identity + description for the popped-out window;
  // stable identity so the effect below only refires when `id` actually changes.
  const load = useCallback(() => {
    if (!id) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/opportunities/${id}`)
      .then(r => {
        const raw = unwrap<RawOpportunityLite>(r)
        const title = raw.title ?? raw.name ?? '?'
        setOpportunity({ id: String(raw.id ?? id), title, initials: initialsOf(title), description: raw.description ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  // Loads on mount and whenever `id` changes (via `load`'s own dependency).
  useEffect(() => { load() }, [load])
  return { opportunity, loading, error, reload: load }
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
