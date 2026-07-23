/**
 * useCandidateSearch — Match-zoeker fase 2/3 (vacancy side): the LIVE scored
 * match endpoint (MATCH-EXPLORER-1) replaces the earlier fase-1 client-side
 * radius search over /candidates. The backend now does the scoring, the radius
 * filter (against the vacancy's own geocoded location) and the best-score-first
 * sort — this hook only wires the filters + a tolerant, LOCAL row mapping.
 * Mirrors the abort/alive idiom of useVacancyActivity (AbortController per
 * fetch, ignore a superseded response).
 */
import { useState, useEffect, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { canonicalizeToOptions, lookupValue } from '@/lib/lookupUtils'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getCandidateTabDefaults } from '../lib/candidateTabVisibility'
import type { CandidateTabConfig } from '../lib/candidateTabVisibility'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface CandidateSearchRow {
  id: Id
  name: string
  city: string
  functionTitle: string
  status: string
  statusLabel: string
  statusColor: string | null
  lat: number | null
  lng: number | null
  distanceKm: number | null
  score: number | null
  criteria: Criterion[]
  aiAdvised: boolean
  aiAdviceReason: string | null
}

// Raw /vacancies/{id}/candidate-matches row — read defensively (snake_case,
// tolerant of gaps). Kept LOCAL on purpose: importing the candidate feature's
// own types/mapper would be a cross-entity import (§2 — entity pages never
// reach into another entity's internals), so this is a minimal, independent
// read of the same wire shape.
interface RawMatchRow {
  candidate?: {
    id?: Id; name?: string; city?: string; function_title?: string
    status?: unknown; status_label?: string; status_color?: string
    lat?: unknown; lng?: unknown
  }
  distance_km?: unknown
  score?: unknown
  criteria?: unknown
  ai_advised?: unknown
  ai_advice_reason?: string | null
}

export function useCandidateSearch(vacancy: VacancyDetail) {
  const { statuses, candidateTypes } = useLookups()

  // Tenant defaults for this tab (Settings → Vacature → Kandidaten zoeken-tabblad,
  // same vacancy_candidate_tab key the drawer's visibility gate reads); a stored
  // (even empty) array wins over the exact-match seed default.
  const allSettings = useAllSettings()
  const candidateTabCfg = getJsonSetting<CandidateTabConfig | null>(allSettings, 'vacancy_candidate_tab', null)
  const tabDefaults = getCandidateTabDefaults([], statuses, candidateTypes)
  const defaultStatusValues = candidateTabCfg?.candidate_statuses ?? tabDefaults.candidate_statuses
  const defaultContractForms = candidateTabCfg?.contract_forms ?? tabDefaults.contract_forms

  const [radiusKm, setRadiusKm]           = useState(30)
  const [functions, setFunctions]         = useState<string[]>(vacancy.category ? [vacancy.category] : [])
  const [statusSel, setStatusSel]         = useState<string[]>(defaultStatusValues)
  const [contractForms, setContractForms] = useState<string[]>(defaultContractForms)

  // The tab is NOT remounted when a different vacancy is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a vacancy switch the same way VacancyDrawer resets its own local
  // state: compare against the previous id during render (React's documented
  // "adjust state during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(vacancy.id)
  if (vacancy.id !== prevId) {
    setPrevId(vacancy.id)
    setRadiusKm(30)
    setFunctions(vacancy.category ? [vacancy.category] : [])
    setStatusSel(defaultStatusValues)
    setContractForms(defaultContractForms)
  }

  // Converge the selection onto the lookup's canonical values once the API rows
  // replace the seed (mirror of the candidate-side fix): the trigger counted the
  // seed value while the checklist compared the API value, so no ✓ showed.
  const canonicalStatuses = canonicalizeToOptions(statusSel, statuses)
  if (canonicalStatuses.join(' ') !== statusSel.join(' ')) setStatusSel(canonicalStatuses)
  const canonicalContractForms = canonicalizeToOptions(contractForms, candidateTypes)
  if (canonicalContractForms.join(' ') !== contractForms.join(' ')) setContractForms(canonicalContractForms)

  const [rows, setRows]       = useState<CandidateSearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const lat = toCoord(vacancy.lat)
  const lng = toCoord(vacancy.lng)
  const noLocation = lat == null || lng == null

  // Pending "refetch after a queued advice refresh" timer (~10s) — a ref so it
  // survives re-renders and can be cancelled both from refreshAdvice() (a second
  // click) and the fetch effect's own cleanup below (unmount, or a param change
  // that already triggers a fresh fetch of its own).
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard).
  useEffect(() => {
    if (noLocation) { setRows([]); setLoading(false); setError(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/vacancies/${vacancy.id}/candidate-matches`, {
      params: {
        radius: radiusKm,
        ...(statusSel.length && { status: statusSel }),
        ...(functions.length && { function_title: functions }),
        ...(contractForms.length && { contract_form: contractForms }),
        per_page: 100,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (the endpoint serves a standard paginator).
        const list = unwrapList<RawMatchRow>(res).rows
        const mapped: CandidateSearchRow[] = list.map(m => {
          const c = m.candidate ?? {}
          return {
            id: c.id ?? '',
            name: c.name ?? '?',
            city: c.city ?? '',
            functionTitle: c.function_title ?? '',
            status: lookupValue(c.status),
            statusLabel: c.status_label ?? '',
            statusColor: c.status_color ?? null,
            lat: toCoord(c.lat), lng: toCoord(c.lng),
            distanceKm: toCoord(m.distance_km),
            score: typeof m.score === 'number' ? m.score : Number(m.score) || null,
            criteria: Array.isArray(m.criteria) ? (m.criteria as Criterion[]) : [],
            aiAdvised: Boolean(m.ai_advised),
            aiAdviceReason: m.ai_advice_reason ?? null,
          }
        })
        // Server-sorted best score first (MatchExplorerService::candidateMatches)
        // — never re-sort locally here, or the fase-2 ranking silently reverts to
        // a plain distance order.
        setRows(mapped)
      })
      .catch(err => { if (err?.code !== 'ERR_CANCELED') setError(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => {
      ctrl.abort()
      // A param/vacancy change already triggers the fresh fetch above — a pending
      // "refetch after advice" timer scheduled against the OLD filters must not
      // ALSO fire (a redundant double fetch); on unmount there is nothing left to
      // refresh into either.
      if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null }
    }
  }, [noLocation, vacancy.id, radiusKm, functions, statusSel, contractForms, reloadKey])

  // Queue a batched Koios advice refresh (fase 3) for this vacancy's best
  // matches. Resolves true on the server's 202 ack, false on any failure
  // (throttle 429 included) — a 202 only ever means "queued", never "done"
  // (§3 honesty: works live only once Anthropic credit is configured).
  const refreshAdvice = async (): Promise<boolean> => {
    try {
      await api.post(`/vacancies/${vacancy.id}/candidate-matches/refresh-advice`)
      // One auto-refetch ~10s later so a landed ai_advised verdict surfaces
      // without the recruiter having to manually retry.
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => setReloadKey(k => k + 1), 10000)
      return true
    } catch {
      return false
    }
  }

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm, setRadiusKm,
    functions, setFunctions,
    statuses: statusSel, setStatuses: setStatusSel,
    contractForms, setContractForms,
    noLocation,
    refreshAdvice,
  }
}
