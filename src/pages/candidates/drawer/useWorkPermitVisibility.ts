/**
 * useWorkPermitVisibility — DANNY-PUNT-1 (2026-08-09): gathers the three live
 * inputs the work-permit visibility rule needs and hands them to the pure
 * decision in `workPermitVisibility.ts` (which carries the rule + the measured
 * API shapes it is built on). This hook only does plumbing.
 *
 * Replaces the previous `useIsNonEuNationality`: that hook asked "is this
 * candidate non-EU?", which is a different question from Danny's ("does the
 * nationality differ from the company's country?") and, because it joined the
 * lookup on an exact name match, never resolved the seeded 'Nederlandse' at all.
 * The `is_eu` flag it read is not lost — it is now one conjunct of the hide
 * condition, so this change can only ever make the card MORE visible, never less.
 *
 * The `/nationalities` GET is deliberately its own uncached request rather than
 * `useNationalities()`: that hook maps the SAME url onto a bare `string[]` and
 * `useCachedLookup` keys its module-scope cache by url alone ("no two lookup
 * hooks share an endpoint" — its own file header), so a second consumer needing
 * `country_code`/`is_eu` would race with and corrupt that cached slot. Folding
 * the extra fields into `useNationalities()` itself would remove this duplicate
 * call, but that hook has ~10 consumers outside this change — flagged as a
 * follow-up rather than done silently here.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import { useAllSettings, getStringSetting } from '@/lib/settings/useAllSettings'
import { isWorkPermitBlockVisible, type NationalityRow, type WorkPermitDataState } from './workPermitVisibility'

export function useWorkPermitVisibility(
  nationality: string | null | undefined,
  dataState: WorkPermitDataState,
): boolean {
  // The tenant's own country — an ISO-2 code ('NL'), read from the shared
  // /settings blob every settings screen already uses.
  const settings = useAllSettings()
  const companyCountry = getStringSetting(settings, 'company_country')

  // null means "the lookup has not answered (yet)", which is NOT the same as an
  // empty list — only a real answer may ever lead to hiding the card.
  const [rows, setRows] = useState<NationalityRow[] | null>(null)

  // Resolve the nationality → country_code bridge once per mount; a failure is
  // swallowed on purpose, leaving `rows` null so the card stays visible.
  useEffect(() => {
    let alive = true
    api.get('/nationalities')
      .then(res => { if (alive) setRows(unwrapList<NationalityRow>(res).rows) })
      .catch(() => { /* unresolved — the rule below keeps the card visible */ })
    return () => { alive = false }
  }, [])

  return isWorkPermitBlockVisible({
    nationality,
    companyCountry,
    rows: rows ?? [],
    lookupResolved: rows !== null,
    dataState,
  })
}
