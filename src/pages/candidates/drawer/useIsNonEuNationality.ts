/**
 * useIsNonEuNationality — KAND-WERKVERGUNNING-2: resolves whether a candidate's
 * nationality sits OUTSIDE the EU/EEA, gating the WorkPermitBlock's visibility.
 * Reads the tenant nationality lookup's `is_eu` flag (GET /nationalities, see
 * NationalityController::validatePayload) — the SAME endpoint useNationalities()
 * already fetches for its dropdown, but that hook keeps only the name and
 * discards is_eu. It is intentionally NOT extended here: useCachedLookup keys its
 * module-scope cache by URL alone ("no two lookup hooks share an endpoint" — its
 * own file header), so a second consumer mapping the same '/nationalities' URL
 * into a different shape would race with useNationalities()'s cached string[] and
 * corrupt whichever hook mounts second. This hook therefore does its own small,
 * uncached fetch instead of touching that shared cache contract — a real extra
 * request, called out here rather than hidden. Folding is_eu into useNationalities()
 * itself would remove the duplicate call, but that hook has ~10 other consumers
 * outside this change's scope, so it stays a follow-up (flagged in the handover).
 *
 * Fail-safe: no nationality set, or the lookup has no matching row, counts as
 * NON-EU — mirrors the backend's own guard (App\Services\Candidate\WorkPermitGuard),
 * so the UI never hides a case the backend would still enforce.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'

export function useIsNonEuNationality(nationality: string | null | undefined): boolean {
  // Default true (fail-safe / "not yet resolved") until the lookup answers otherwise.
  const [nonEu, setNonEu] = useState(true)

  useEffect(() => {
    let alive = true
    const name = (nationality ?? '').trim()
    // No nationality on file — fail-safe (see file header), nothing to fetch.
    if (!name) { setNonEu(true); return }

    api.get('/nationalities')
      .then(res => {
        if (!alive) return
        const rows = unwrapList(res).rows as Array<{ name?: string; is_eu?: boolean }>
        const match = rows.find(r => r.name === name)
        setNonEu(match?.is_eu !== true)
      })
      .catch(() => { if (alive) setNonEu(true) })

    return () => { alive = false }
  }, [nationality])

  return nonEu
}
