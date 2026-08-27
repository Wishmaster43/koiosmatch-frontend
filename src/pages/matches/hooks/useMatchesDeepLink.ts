/**
 * useMatchesDeepLink — the matches page's cross-entity open + URL-mirror wiring:
 * parks a deep-linked match id until its row loads, falls back to a direct fetch
 * when the target sits outside the current page/filters (Danny 20-07: match-link
 * 'deed niets'), and mirrors the open drawer in ?open=<id> (NAV-BACK-1).
 * Extracted out of MatchesPage (§3 split trigger).
 */
import { useEffect, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useOpenFromIntent } from '@/context/NavigationContext'
import { mapMatch } from './useMatches'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

// Wires intent/deep-link opens for the matches list; the caller owns `selected`.
export function useMatchesDeepLink({ intent, rows, loading, selected, setSelected, t }: {
  intent: unknown
  rows: MatchRow[]
  loading: boolean
  selected: MatchRow | null
  setSelected: (row: MatchRow | null) => void
  t: TFunction
}) {
  // Cross-entity open ({ open: id }): the drawer needs the ROW, so park the id until
  // the rows are loaded, then select the matching one (candidate drawer → match).
  const [pendingOpenId, setPendingOpenId] = useState<Id | null>(null)
  // Guards the one-shot direct fetch for a deep-link open (see effect below).
  const fetchingOpenRef = useRef<string | null>(null)

  useOpenFromIntent(intent, (id) => setPendingOpenId(id))
  // Opens the deep-linked match once its row is loaded; if it sits outside the current page/filters, fetches it directly instead of silently dropping the open.
  useEffect(() => {
    if (pendingOpenId == null) return
    const row = rows.find(r => String(r.id) === String(pendingOpenId))
    if (row) { setSelected(row); setPendingOpenId(null); return }
    // Deep-link fallback: the target may not be in the loaded page (pagination/
    // filters) — fetch it directly, like the candidates/vacancies openById paths.
    if (loading || fetchingOpenRef.current === String(pendingOpenId)) return
    fetchingOpenRef.current = String(pendingOpenId)
    api.get(`/matches/${pendingOpenId}`, { params: { include_archived: 1 } })
      .then(r => { setSelected(mapMatch(unwrap(r))); setPendingOpenId(null) })
      .catch(() => { notifyError(t('page.openNotFound')); setPendingOpenId(null) })
      .finally(() => { fetchingOpenRef.current = null })
  }, [pendingOpenId, rows, loading, t, setSelected])
  // Mirror the open drawer in the URL (?open=<id>): browser back/forward walks
  // through it and a copied link reopens the same match (NAV-BACK-1).
  useDrawerUrl({ selectedId: selected?.id, openById: setPendingOpenId, close: () => setSelected(null), intent })
}
