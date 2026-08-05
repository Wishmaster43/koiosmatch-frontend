/**
 * useVacancySearch — Match-zoeker fase 1b (candidate side): now the MIRROR of
 * useCandidateSearch (vacancy side) onto the completed LIVE scored endpoint
 * (MATCH-EXPLORER-1 fase 2/3, CMBE mirror delivery 23-07). Replaces the earlier
 * two-fetch workaround (a plain /vacancies list + a separate score merge) with
 * ONE abortable fetch to /candidates/{id}/vacancy-matches — the backend now
 * does the scoring, the radius filter (against the candidate's own geocoded
 * location) and the best-score-first sort. Mirrors the abort/alive idiom
 * (AbortController per fetch, ignore a superseded response, adjust-during-
 * render reset on an entity switch).
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { canonicalizeToOptions, lookupValue } from '@/lib/lookupUtils'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useFunctions } from '@/lib/useFunctions'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getVacancyTabDefaults } from '../lib/vacancyTabVisibility'
import type { VacancyTabConfig } from '../lib/vacancyTabVisibility'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export interface VacancySearchRow {
  id: Id
  title: string
  customer: string
  city: string
  status: string
  functionTitle: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
  score: number | null
  criteria: Criterion[]
  aiAdvised: boolean
  aiAdviceReason: string | null
}

// Raw /candidates/{id}/vacancy-matches row — read defensively (snake_case,
// tolerant of gaps). Kept LOCAL on purpose: importing the vacancy feature's
// own types/mapper would be a cross-entity import (§2 — entity pages never
// reach into another entity's internals), so this is a minimal, independent
// read of the same wire shape (MatchExplorerService::vacancyShape).
interface RawMatchRow {
  vacancy?: {
    id?: Id; reference_number?: string; title?: string
    location_city?: string; city?: string
    customer_name?: string; function_title?: string
    lat?: unknown; lng?: unknown
    employment_type?: string; status?: unknown
  }
  distance_km?: unknown
  score?: unknown
  criteria?: unknown
  ai_advised?: unknown
  ai_advice_reason?: string | null
}

// Per-candidate travel preference (Danny 23-07): the radius default follows the
// candidate's OWN `preferences.max_travel_km`, falling back to a calm 30km when
// that isn't set (or isn't a usable positive number).
function defaultRadiusKm(candidate: Candidate): number {
  const pref = Number((candidate.preferences as { max_travel_km?: unknown } | undefined)?.max_travel_km)
  return Number.isFinite(pref) && pref > 0 ? pref : 30
}

// Ghost-filter fix (Danny 05-08): the candidate's own `title` (e.g. "Verpleegkundige")
// often has NO exact match in the tenant's /functions lookup (which may only carry
// "Verpleegkundige N4"/"N5") — seeding that raw title selected a value the SearchSelect
// can render no check for AND the API can't match on (zero results, no visible cause).
// Match EXACT + case-insensitive only — never a prefix expansion (a scope-of-practice
// title must never auto-select a DIFFERENT function, e.g. Verzorgende-anything) — and
// return the option's OWN casing so the stored value lines up with what renders.
function matchFunctionOption(title: string | null | undefined, options: string[]): string | null {
  const needle = (title ?? '').trim().toLowerCase()
  if (!needle) return null
  return options.find(o => o.toLowerCase() === needle) ?? null
}

export function useVacancySearch(candidate: Candidate) {
  const { statuses } = useVacancyLookups()
  const { functions: functionOptions } = useFunctions()
  // Tenant default vacancy-status preselection (Settings → Candidate →
  // Vacatures-tabblad, same `candidate_vacancy_tab` key the tab-visibility gate
  // reads) — kept in ONE place (this hook) so every consumer sees the same
  // pre-checked statuses; a stored (even empty) array always wins over the seed.
  const allSettings = useAllSettings()
  const vacancyTabCfg = getJsonSetting<VacancyTabConfig | null>(allSettings, 'candidate_vacancy_tab', null)
  const defaultStatusValues = vacancyTabCfg?.vacancy_statuses ?? getVacancyTabDefaults([], [], [], statuses).vacancy_statuses

  const [radiusKm, setRadiusKm]         = useState(() => defaultRadiusKm(candidate))
  const [functions, setFunctionsState]  = useState<string[]>(() => {
    const match = matchFunctionOption(candidate.title, functionOptions)
    return match ? [match] : []
  })
  const [statusSel, setStatusSel] = useState<string[]>(defaultStatusValues)

  // A manual pick wins forever for this candidate — the tenant lookup arriving late
  // (async fallback → real data) must never clobber the user's own toggle. Plain
  // state (not a ref) — react-hooks/refs forbids reading/writing a ref during the
  // render-phase "adjust state" block below, and this flag needs exactly that.
  const [userTouchedFunctions, setUserTouchedFunctions] = useState(false)
  const setFunctions: Dispatch<SetStateAction<string[]>> = updater => {
    setUserTouchedFunctions(true)
    setFunctionsState(updater)
  }

  // The tab is NOT remounted when a different candidate is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a candidate switch the same way the vacancy side does: compare
  // against the previous id during render (React's documented "adjust state
  // during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(candidate.id)
  if (candidate.id !== prevId) {
    setPrevId(candidate.id)
    setRadiusKm(defaultRadiusKm(candidate))
    setUserTouchedFunctions(false)
    setFunctionsState(() => {
      const match = matchFunctionOption(candidate.title, functionOptions)
      return match ? [match] : []
    })
    setStatusSel(defaultStatusValues)
  }

  // useFunctions() resolves async (a synchronous seed fallback, then the REAL
  // tenant list) — re-seed once the real list lands so a late-arriving exact match
  // still gets picked up, but only while the user hasn't made their own choice yet.
  useEffect(() => {
    if (userTouchedFunctions) return
    const match = matchFunctionOption(candidate.title, functionOptions)
    const next = match ? [match] : []
    // Bail on a content-equal result (comparing via the FUNCTIONAL updater, not the
    // `functions` closure, so this effect needs no extra dependency) — a fresh `[]`
    // is a different array reference from the initial seed's own `[]`, and without
    // this guard every mount fired a harmless-looking but wasteful SECOND fetch (the
    // vacancy-matches effect below re-triggers on any new `functions` reference).
    setFunctionsState(prev => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- candidate.id/title drive the prevId block above; only re-seed here on a genuine functionOptions arrival.
  }, [functionOptions, userTouchedFunctions])

  // Converge the selection onto the lookup's canonical values once the API rows
  // replace the seed (same adjust-during-render pattern as above) — otherwise the
  // trigger counts 'open' while the checklist compares 'Open' and no ✓ shows.
  const canonicalStatuses = canonicalizeToOptions(statusSel, statuses)
  if (canonicalStatuses.join(' ') !== statusSel.join(' ')) setStatusSel(canonicalStatuses)

  const [rows, setRows]           = useState<VacancySearchRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const lat = toCoord(candidate.lat)
  const lng = toCoord(candidate.lng)
  const noLocation = lat == null || lng == null

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard). ONE request
  // now serves both the vacancy rows and their live scores — the backend
  // resolves the search origin from the candidate's own geocode.
  useEffect(() => {
    if (noLocation) { setRows([]); setLoading(false); setError(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidate.id}/vacancy-matches`, {
      params: {
        radius: radiusKm,
        ...(statusSel.length && { status: statusSel }),
        ...(functions.length && { function_title: functions }),
        per_page: 100,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (the endpoint serves a standard paginator).
        const list = unwrapList<RawMatchRow>(res).rows
        const mapped: VacancySearchRow[] = list.map(m => {
          const v = m.vacancy ?? {}
          return {
            id: v.id ?? '',
            title: v.title ?? '',
            customer: v.customer_name ?? '',
            city: v.location_city ?? v.city ?? '',
            status: lookupValue(v.status),
            functionTitle: v.function_title ?? '',
            lat: toCoord(v.lat), lng: toCoord(v.lng),
            distanceKm: toCoord(m.distance_km),
            score: typeof m.score === 'number' ? m.score : Number(m.score) || null,
            criteria: Array.isArray(m.criteria) ? (m.criteria as Criterion[]) : [],
            aiAdvised: Boolean(m.ai_advised),
            aiAdviceReason: m.ai_advice_reason ?? null,
          }
        })
        // Server-sorted best score first (MatchExplorerService::vacancyMatches)
        // — never re-sort locally here, or the fase-2 ranking silently reverts to
        // a plain distance order.
        setRows(mapped)
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [noLocation, candidate.id, radiusKm, statusSel, functions, reloadKey])

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    statuses: statusSel, setStatuses: setStatusSel,
    noLocation,
  }
}
