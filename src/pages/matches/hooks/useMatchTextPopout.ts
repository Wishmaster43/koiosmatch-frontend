/**
 * useMatchTextPopout — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): de matchtekst
 * krijgt het profieltekst-recept, dus ook de second-screen-popout. Mirrors
 * useVacancyTextPopout 1:1 — a light identity fetch for the popped-out window
 * plus a standalone PATCH /matches/{id} on the SAME `match_text` field the
 * drawer's own MatchTextBlock writes through useMatchContract.save.
 */
import { useCallback, useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface MatchTextLite { id: string; title: string; initials: string; matchText: string }

// The subset of the raw match resource this popout actually reads.
interface RawMatchLite {
  id?: Id
  candidate?: { name?: string } | null
  vacancy?: { title?: string } | null
  match_text?: string | null
}

// Light identity fetch for the popped-out match-text window.
export function useMatchTextLite(id: string | undefined) {
  const [match, setMatch] = useState<MatchTextLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!id) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/matches/${id}`)
      .then(r => {
        const raw = unwrap<RawMatchLite>(r)
        // Kandidaat — vacature als venstertitel; het kastlijntje is hier een
        // scheidingsteken tussen twee gegevenswaarden (§5-uitzondering).
        const title = [raw.candidate?.name, raw.vacancy?.title].filter(Boolean).join(' — ') || '?'
        setMatch({ id: String(raw.id ?? id), title, initials: initialsOf(raw.candidate?.name ?? title), matchText: raw.match_text ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])
  return { match, loading, error, reload: load }
}

// Standalone PATCH /matches/{id} — same field MatchTextBlock writes.
export function patchMatchText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/matches/${id}`, { match_text: html || null })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
