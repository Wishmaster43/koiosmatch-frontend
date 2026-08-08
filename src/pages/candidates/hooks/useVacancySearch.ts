/**
 * useVacancySearch — Match-zoeker fase 1b (candidate side): now the MIRROR of
 * useCandidateSearch (vacancy side) onto the completed LIVE scored endpoint
 * (MATCH-EXPLORER-1 fase 2/3, CMBE mirror delivery 23-07). Replaces the earlier
 * two-fetch workaround (a plain /vacancies list + a separate score merge) with
 * ONE abortable fetch to /candidates/{id}/vacancy-matches — the backend now
 * does the scoring, the radius filter (against the candidate's own geocoded
 * location) and the best-score-first sort. Mirrors the abort/alive idiom
 * (AbortController per fetch, ignore a superseded response, adjust-during-
 * render reset on an entity switch). The pure seed/filter rules live next door
 * in vacancySearchFilters.ts.
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { canonicalizeToOptions, lookupValue } from '@/lib/lookupUtils'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useLookups } from '@/context/LookupsContext'
import { useFunctions } from '@/lib/useFunctions'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getVacancyTabDefaults } from '../lib/vacancyTabVisibility'
import type { VacancyTabConfig } from '../lib/vacancyTabVisibility'
import {
  HOURS_RANGE_MAX, applyClientFilters, defaultAvailableFrom, defaultHoursRange,
  defaultRadiusKm, matchFunctionOption, sameValues,
} from './vacancySearchFilters'
import type { HoursRange, VacancySearchRow } from './vacancySearchFilters'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export type { VacancySearchRow, HoursRange } from './vacancySearchFilters'

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
    // Measured live 09-08 (yesway): these three ARE shipped by vacancyShape. The
    // KEY's mere presence (even with a null value) drives the gated filters below.
    hours_min?: unknown; hours_max?: unknown; start_date?: unknown
  }
  distance_km?: unknown
  score?: unknown
  criteria?: unknown
  ai_advised?: unknown
  ai_advice_reason?: string | null
}

// Debounce window for the radius→fetch trigger (Danny 06-08 network-tab feedback):
// a slider DRAG must settle before the request fires, not fire once per tick.
const RADIUS_DEBOUNCE_MS = 350

export function useVacancySearch(candidate: Candidate) {
  const { statuses } = useVacancyLookups()
  const { functions: functionOptions } = useFunctions()
  // Tenant candidateTypes lookup (Contractvorm labels + colours) — the SAME axis
  // PreferencesTab reads via useLookups(), reused here to seed/offer the new
  // contract-form filter (Danny 06-08 "eerst de extra filters").
  const { candidateTypes, typeMeta } = useLookups()
  // Tenant default vacancy-status preselection (Settings → Candidate →
  // Vacatures-tabblad, same `candidate_vacancy_tab` key the tab-visibility gate
  // reads) — kept in ONE place (this hook) so every consumer sees the same
  // pre-checked statuses; a stored (even empty) array always wins over the seed.
  const allSettings = useAllSettings()
  const vacancyTabCfg = getJsonSetting<VacancyTabConfig | null>(allSettings, 'candidate_vacancy_tab', null)
  const defaultStatusValues = vacancyTabCfg?.vacancy_statuses ?? getVacancyTabDefaults([], [], [], statuses).vacancy_statuses

  // The per-candidate STARTING values, recomputed every render from the same
  // inputs the initial state and the re-seed effects use — one source of truth for
  // the reset action and for the "is anything actually changed?" test behind it.
  const radiusSeed = defaultRadiusKm(candidate)
  const functionMatch = matchFunctionOption(candidate.title, functionOptions)
  const functionSeed = functionMatch ? [functionMatch] : []
  const statusSeed = canonicalizeToOptions(defaultStatusValues, statuses)
  const hoursRangeSeed = defaultHoursRange(candidate)
  const availableFromSeed = defaultAvailableFrom(candidate)

  const [radiusKm, setRadiusKm]         = useState(radiusSeed)
  // The slider/map bind to the LIVE radiusKm above (instant feedback); the fetch
  // effect below reads THIS debounced echo instead, so a drag never fires one
  // request per tick — only once the value has settled for RADIUS_DEBOUNCE_MS.
  const [debouncedRadiusKm, setDebouncedRadiusKm] = useState(radiusKm)
  const [functions, setFunctionsState]  = useState<string[]>(functionSeed)
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

  // Contract-form (Contractvorm) filter — same "seeded-once, user pick wins forever"
  // idiom as the function filter above (userTouched flag + a wrapped setter).
  const [contractvorm, setContractvormState] = useState<string[]>([])
  const [userTouchedContractvorm, setUserTouchedContractvorm] = useState(false)
  const setContractvorm: Dispatch<SetStateAction<string[]>> = updater => {
    setUserTouchedContractvorm(true)
    setContractvormState(updater)
  }

  // "Uren per week" range + "Inzetbaar vanaf" date — plain editable filters, seeded
  // once from the candidate's OWN preferences (synchronously available on the prop,
  // unlike the async tenant lookups above, so no userTouched merge-back is needed).
  const [hoursRange, setHoursRange] = useState<HoursRange>(hoursRangeSeed)
  const [availableFrom, setAvailableFrom] = useState(availableFromSeed)

  // The tab is NOT remounted when a different candidate is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a candidate switch the same way the vacancy side does: compare
  // against the previous id during render (React's documented "adjust state
  // during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(candidate.id)
  if (candidate.id !== prevId) {
    setPrevId(candidate.id)
    setRadiusKm(radiusSeed)
    // A candidate switch is a hard reset, not a drag — settle the fetch trigger
    // immediately too, or the new candidate's first fetch waits out the debounce.
    setDebouncedRadiusKm(radiusSeed)
    setUserTouchedFunctions(false)
    setFunctionsState(functionSeed)
    setStatusSel(defaultStatusValues)
    // New candidate → blank contract-form pick (the seeding effect below re-derives
    // it once the fresh rows/lookup are in), and re-seed the plain preference filters.
    setUserTouchedContractvorm(false)
    setContractvormState([])
    setHoursRange(hoursRangeSeed)
    setAvailableFrom(availableFromSeed)
  }

  // useFunctions() resolves async (a synchronous seed fallback, then the REAL
  // tenant list) — re-seed once the real list lands so a late-arriving exact match
  // still gets picked up, but only while the user hasn't made their own choice yet.
  useEffect(() => {
    if (userTouchedFunctions) return
    // Bail on a content-equal result (comparing via the FUNCTIONAL updater, not the
    // `functions` closure, so this effect needs no extra dependency) — a fresh `[]`
    // is a different array reference from the initial seed's own `[]`, and without
    // this guard every mount fired a harmless-looking but wasteful SECOND fetch (the
    // vacancy-matches effect below re-triggers on any new `functions` reference).
    setFunctionsState(prev => (sameValues(prev, functionSeed) ? prev : functionSeed))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- candidate.id/title drive the prevId block above; only re-seed here on a genuine functionOptions arrival.
  }, [functionOptions, userTouchedFunctions])

  // Converge the selection onto the lookup's canonical values once the API rows
  // replace the seed (same adjust-during-render pattern as above) — otherwise the
  // trigger counts 'open' while the checklist compares 'Open' and no ✓ shows.
  const canonicalStatuses = canonicalizeToOptions(statusSel, statuses)
  if (canonicalStatuses.join(' ') !== statusSel.join(' ')) setStatusSel(canonicalStatuses)

  // Raw fetch result — server-filtered (radius/status/function) but NOT yet by the
  // three client-side filters below; `rows` (returned at the bottom) is the derived,
  // fully-filtered view. Kept separate so the filter OPTIONS (contractvormOptions)
  // and the presence gates always reflect the full fetched set, not the narrowed one.
  const [rawRows, setRawRows]     = useState<VacancySearchRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // OFFERED-IFF-READ (mirrors MatchTextBlock): whether ANY fetched row's vacancy
  // object carries the hours_min/hours_max/start_date KEY at all (even if null) —
  // a filter only appears once the data behind it is demonstrably there.
  const [hasHoursData, setHasHoursData]         = useState(false)
  const [hasAvailableFromData, setHasAvailableFromData] = useState(false)

  const lat = toCoord(candidate.lat)
  const lng = toCoord(candidate.lng)
  const noLocation = lat == null || lng == null

  // Settle the fetch trigger: echoes radiusKm after RADIUS_DEBOUNCE_MS of quiet —
  // status/function toggles are discrete clicks and stay un-debounced below.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRadiusKm(radiusKm), RADIUS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [radiusKm])

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard). ONE request
  // now serves both the vacancy rows and their live scores — the backend
  // resolves the search origin from the candidate's own geocode. `radius` reads
  // the DEBOUNCED value (see above) — every other param fires immediately.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidate.id}/vacancy-matches`, {
      params: {
        // GEO-DEGRADE-1 (Danny 08-08 "vacatures zoeken werkt niet meer + de filters
        // verdwijnen"): an un-geocoded candidate used to bail out here, which killed
        // the whole tab — filters, list and all. Measured against the live endpoint:
        // it happily scores and ranks WITHOUT an origin (9 rows, score 66, distance
        // null), so only the radius is dropped. The map/distance stay hidden (they
        // genuinely need coordinates) — the search itself keeps working.
        ...(noLocation ? {} : { radius: debouncedRadiusKm }),
        ...(statusSel.length && { status: statusSel }),
        ...(functions.length && { function_title: functions }),
        per_page: 100,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (the endpoint serves a standard paginator).
        const list = unwrapList<RawMatchRow>(res).rows
        // Presence gate on the RAW vacancy object — a KEY that exists (even null)
        // counts, so the filter shows the moment the backend starts sending it.
        setHasHoursData(list.some(m => 'hours_min' in (m.vacancy ?? {}) || 'hours_max' in (m.vacancy ?? {})))
        setHasAvailableFromData(list.some(m => 'start_date' in (m.vacancy ?? {})))
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
            employmentType: v.employment_type ?? null,
            hoursMin: toCoord(v.hours_min),
            hoursMax: toCoord(v.hours_max),
            startDate: typeof v.start_date === 'string' ? v.start_date : null,
          }
        })
        // Server-sorted best score first (MatchExplorerService::vacancyMatches)
        // — never re-sort locally here, or the fase-2 ranking silently reverts to
        // a plain distance order.
        setRawRows(mapped)
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [noLocation, candidate.id, debouncedRadiusKm, statusSel, functions, reloadKey])

  // Contract-form OPTIONS: the tenant candidateTypes LABELS unioned with whatever
  // employment_type labels the fetched rows actually carry — a label outside the
  // lookup (renamed/legacy value) stays filterable instead of silently vanishing.
  const contractvormOptions = Array.from(new Set([
    ...candidateTypes.map(ct => ct.label),
    ...rawRows.map(r => r.employmentType).filter((v): v is string => Boolean(v)),
  ]))

  // Contract-form SEED: the candidate's OWN contractvorm (slugs → labels via the
  // tenant lookup), intersected with what's actually offerable right now — never
  // seed a chip the SearchSelect can't render a match for.
  const contractvormSeed = (candidate.candidateTypes ?? [])
    .map(slug => typeMeta(slug).label)
    .filter((l): l is string => Boolean(l))
    .filter(l => contractvormOptions.includes(l))

  // Apply that seed while the user hasn't picked their own, re-running so a
  // late-arriving lookup/row set still converges (mirrors the function re-seed above).
  useEffect(() => {
    if (userTouchedContractvorm) return
    setContractvormState(prev => (sameValues(prev, contractvormSeed) ? prev : contractvormSeed))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- candidate switches are handled by the prevId block above; only re-seed here on a genuine lookup/rows arrival.
  }, [candidateTypes, rawRows, userTouchedContractvorm])

  // FILTER-HINT (Danny 06-08 live feedback): the candidate's own function title has
  // NO exact match in the tenant lookup, so the Functie filter above seeded EMPTY
  // and silently searches every function — surface that as a small hint instead of
  // a silent gap. Empty title never triggers it (nothing to mismatch).
  const functionNotInLookup = Boolean(candidate.title?.trim()) && !functionMatch

  // Whether ANY filter differs from its starting value. The two lookup-seeded
  // filters only count once the user has actually touched them — while untouched
  // their re-seed effects converge them to the seed anyway, and comparing before
  // that flashed the reset button on every mount.
  const filtersDirty =
    radiusKm !== radiusSeed ||
    (userTouchedFunctions && !sameValues(functions, functionSeed)) ||
    (userTouchedContractvorm && !sameValues(contractvorm, contractvormSeed)) ||
    !sameValues(statusSel, statusSeed) ||
    hoursRange[0] !== hoursRangeSeed[0] || hoursRange[1] !== hoursRangeSeed[1] ||
    availableFrom !== availableFromSeed

  // Reset every filter to its per-candidate STARTING value — the seeds above, not
  // blanks, so the radius and the candidate's own preferences come back too.
  const resetFilters = () => {
    setRadiusKm(radiusSeed)
    // A reset is a discrete click, not a drag — settle the fetch trigger at once.
    setDebouncedRadiusKm(radiusSeed)
    setUserTouchedFunctions(false)
    setFunctionsState(functionSeed)
    setStatusSel(statusSeed)
    setUserTouchedContractvorm(false)
    setContractvormState(contractvormSeed)
    setHoursRange(hoursRangeSeed)
    setAvailableFrom(availableFromSeed)
  }

  // The fully-filtered view returned to the tab — client-side only (the API set is
  // already radius/status/function bounded), so no extra network round-trip.
  const rows = applyClientFilters(rawRows, contractvorm, hoursRange, availableFrom)

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    functionNotInLookup,
    contractvorm, setContractvorm, contractvormOptions,
    hoursRange, setHoursRange, hoursRangeMax: HOURS_RANGE_MAX, hasHoursData,
    availableFrom, setAvailableFrom, hasAvailableFromData,
    statuses: statusSel, setStatuses: setStatusSel,
    filtersDirty, resetFilters,
    noLocation,
  }
}
