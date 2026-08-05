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
import { useLookups } from '@/context/LookupsContext'
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
  // Contract-form LABEL as returned by the vacancy ("ZZP"/"Oproep"/"Tijdelijk"/…) —
  // already tenant-configured text, not a slug (MatchExplorerService::vacancyShape).
  employmentType: string | null
  // Weekly-hours range + start date (CMBE ticket in flight, Danny 06-08) — null when
  // the backend hasn't shipped the field yet OR the vacancy itself left it empty;
  // both cases are handled identically by the "never exclude" filter rule below.
  hoursMin: number | null
  hoursMax: number | null
  startDate: string | null
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
    // Not shipped yet (CMBE ticket in flight) — read defensively; the KEY's mere
    // presence (even with a null value) drives the gated filters' visibility below.
    hours_min?: unknown; hours_max?: unknown; start_date?: unknown
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

// Debounce window for the radius→fetch trigger (Danny 06-08 network-tab feedback):
// a slider DRAG must settle before the request fires, not fire once per tick.
const RADIUS_DEBOUNCE_MS = 350

// Seed the "Uren per week" MIN filter from the candidate's own hours preference
// (max stays empty — an open-ended upper bound until the recruiter narrows it).
function defaultHoursMin(candidate: Candidate): string {
  const pref = Number((candidate.preferences as { hours_per_week?: unknown } | undefined)?.hours_per_week)
  return Number.isFinite(pref) && pref > 0 ? String(pref) : ''
}

// Seed the "Inzetbaar vanaf" filter from the candidate's own available-from date.
// Sliced to the date-only part — the preference may carry a full timestamp.
function defaultAvailableFrom(candidate: Candidate): string {
  const pref = (candidate.preferences as { available_from?: unknown } | undefined)?.available_from
  return typeof pref === 'string' && pref ? pref.slice(0, 10) : ''
}

// Range-overlap test for the "Uren per week" filter — a vacancy carrying NEITHER
// hours_min NOR hours_max is never excluded (no data to filter on); an open filter
// bound (empty min/max) never narrows the range either.
function hoursOverlap(row: VacancySearchRow, min: string, max: string): boolean {
  if (row.hoursMin == null && row.hoursMax == null) return true
  const vMin = row.hoursMin ?? -Infinity
  const vMax = row.hoursMax ?? Infinity
  const fMin = min !== '' ? Number(min) : -Infinity
  const fMax = max !== '' ? Number(max) : Infinity
  return vMin <= fMax && fMin <= vMax
}

// "Inzetbaar vanaf" filter: keep vacancies whose start_date is on/after the chosen
// date. A vacancy without its own start_date is never excluded (no data to filter
// on); date-only string comparison is safe since both sides are ISO 'YYYY-MM-DD'.
function afterAvailableFrom(row: VacancySearchRow, chosen: string): boolean {
  if (!chosen || !row.startDate) return true
  return row.startDate.slice(0, 10) >= chosen
}

// Client-side filters over the ALREADY-FETCHED rows (Danny 06-08 "eerst de extra
// filters") — the set is already radius/status/function bounded by the server; these
// three narrow it further without a second network round-trip.
function applyClientFilters(rows: VacancySearchRow[], contractvorm: string[], hoursMin: string, hoursMax: string, availableFrom: string): VacancySearchRow[] {
  return rows.filter(r =>
    (contractvorm.length === 0 || contractvorm.includes(r.employmentType ?? '')) &&
    hoursOverlap(r, hoursMin, hoursMax) &&
    afterAvailableFrom(r, availableFrom),
  )
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

  const [radiusKm, setRadiusKm]         = useState(() => defaultRadiusKm(candidate))
  // The slider/map bind to the LIVE radiusKm above (instant feedback); the fetch
  // effect below reads THIS debounced echo instead, so a drag never fires one
  // request per tick — only once the value has settled for RADIUS_DEBOUNCE_MS.
  const [debouncedRadiusKm, setDebouncedRadiusKm] = useState(radiusKm)
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
  const [hoursMin, setHoursMin] = useState(() => defaultHoursMin(candidate))
  const [hoursMax, setHoursMax] = useState('')
  const [availableFrom, setAvailableFrom] = useState(() => defaultAvailableFrom(candidate))

  // The tab is NOT remounted when a different candidate is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a candidate switch the same way the vacancy side does: compare
  // against the previous id during render (React's documented "adjust state
  // during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(candidate.id)
  if (candidate.id !== prevId) {
    setPrevId(candidate.id)
    setRadiusKm(defaultRadiusKm(candidate))
    // A candidate switch is a hard reset, not a drag — settle the fetch trigger
    // immediately too, or the new candidate's first fetch waits out the debounce.
    setDebouncedRadiusKm(defaultRadiusKm(candidate))
    setUserTouchedFunctions(false)
    setFunctionsState(() => {
      const match = matchFunctionOption(candidate.title, functionOptions)
      return match ? [match] : []
    })
    setStatusSel(defaultStatusValues)
    // New candidate → blank contract-form pick (the seeding effect below re-derives
    // it once the fresh rows/lookup are in), and re-seed the plain preference filters.
    setUserTouchedContractvorm(false)
    setContractvormState([])
    setHoursMin(defaultHoursMin(candidate))
    setHoursMax('')
    setAvailableFrom(defaultAvailableFrom(candidate))
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
  // the CMBE fields are in flight, so the gated filters stay hidden until they land.
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
    if (noLocation) { setRawRows([]); setLoading(false); setError(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidate.id}/vacancy-matches`, {
      params: {
        radius: debouncedRadiusKm,
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

  // Seed the contract-form filter from the candidate's OWN contractvorm (slugs ->
  // labels via the tenant lookup), intersected with what's actually offerable right
  // now — never seed a chip the SearchSelect can't render a match for. Re-runs
  // while untouched so a late-arriving lookup/row set still converges (mirrors the
  // function filter's re-seed effect above).
  useEffect(() => {
    if (userTouchedContractvorm) return
    const candidateLabels = (candidate.candidateTypes ?? [])
      .map(slug => typeMeta(slug).label)
      .filter((l): l is string => Boolean(l))
    const seed = candidateLabels.filter(l => contractvormOptions.includes(l))
    setContractvormState(prev => (prev.length === seed.length && prev.every((v, i) => v === seed[i]) ? prev : seed))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- candidate switches are handled by the prevId block above; only re-seed here on a genuine lookup/rows arrival.
  }, [candidateTypes, rawRows, userTouchedContractvorm])

  // FILTER-HINT (Danny 06-08 live feedback): the candidate's own function title has
  // NO exact match in the tenant lookup, so the Functie filter above seeded EMPTY
  // and silently searches every function — surface that as a small hint instead of
  // a silent gap. Empty title never triggers it (nothing to mismatch).
  const functionNotInLookup = Boolean(candidate.title?.trim()) && !matchFunctionOption(candidate.title, functionOptions)

  // The fully-filtered view returned to the tab — client-side only (the API set is
  // already radius/status/function bounded), so no extra network round-trip.
  const rows = applyClientFilters(rawRows, contractvorm, hoursMin, hoursMax, availableFrom)

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    functionNotInLookup,
    contractvorm, setContractvorm, contractvormOptions,
    hoursMin, setHoursMin, hoursMax, setHoursMax, hasHoursData,
    availableFrom, setAvailableFrom, hasAvailableFromData,
    statuses: statusSel, setStatuses: setStatusSel,
    noLocation,
  }
}
