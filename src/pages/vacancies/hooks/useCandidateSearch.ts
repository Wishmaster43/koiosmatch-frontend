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
import { mapSearchHit } from '@/lib/searchScore'
import { canonicalizeToOptions, lookupValue } from '@/lib/lookupUtils'
import { useLookups } from '@/context/LookupsContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import type { CandidateTabConfig } from '../lib/candidateTabVisibility'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'
import { resolveWorkflowBaseURL } from '@/lib/workflowApi'
import { TERMINAL } from '@/components/layout/workflow/useWorkflowRun'

// LEADS-CIRKEL-1 (BE 3d6a92b1): the criteria block the server ACTUALLY applied,
// served alongside the paginator — the tab displays these instead of guessing
// its own seeds, so the leads cell and this tab always describe one population.
export interface AppliedCriteria {
  function_titles: string[]
  radius_km: number | null
  geo_missing: boolean
  include_expiring_matches: boolean
  expiring_within_days: number | null
}

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

// Owns the live scored candidate-match search for one vacancy: filter state (with
// tenant defaults), the abortable fetch, and the Koios advice-refresh side channel.
// The seeded manual template the rematch button runs (VAC-LEADS-RECOUNT-BUTTON-1, REMATCH-KNOP-1).
export const REMATCH_TEMPLATE_KEY = 'vacancy_leads_recount_single'
export type RematchOutcome = 'started' | 'busy' | 'missing' | 'budget' | 'failed'

export function useCandidateSearch(vacancy: VacancyDetail) {
  const { statuses, candidateTypes } = useLookups()

  // Tenant defaults for this tab (Settings → Vacature → Kandidaten zoeken-tabblad,
  // same vacancy_candidate_tab key the drawer's visibility gate reads); a stored
  // (even empty) array wins over the exact-match seed default.
  const allSettings = useAllSettings()
  // RADIUS-SETTING-1: `default_radius_km` is a new field on the same JSON blob,
  // not (yet) part of the shared `CandidateTabConfig` type (out of this task's
  // file list) — a local intersection type reads it without widening that
  // shared interface for every other caller.
  const candidateTabCfg = getJsonSetting<(CandidateTabConfig & { default_radius_km?: number }) | null>(
    allSettings, 'vacancy_candidate_tab', null,
  )
  // LEADS-PARITY-1 (Danny 25-08): the seed regex in getCandidateTabDefaults
  // ("available"/"beschikbaar") is a soft FORM default only (mirrors the
  // settings screen's own pre-save preview) — it must never become a default
  // FILTER, or the tab's own request silently narrows past the leads counter's
  // population. A tenant's SAVED `vacancy_candidate_tab.candidate_statuses`
  // still applies (an explicit tenant choice, not a guess); absent that, the
  // default is an empty selection — no status[] sent at all.
  // RADIUS-SETTING-1 (Danny 25-07): the search radius now comes from the SAME
  // tenant setting that already drives this tab's status/contract-form defaults
  // (vacancy_candidate_tab.default_radius_km), not a hardcoded 30 — a tenant with
  // a sparse region can widen it, one with a dense city can tighten it.
  // NOTE (known, ticketed): the function/status filter semantics below are left
  // untouched in this pass — changing those would silently alter which candidates
  // match, and that is a separate backend-side ticket, not a radius fix.
  const defaultRadiusKm = candidateTabCfg?.default_radius_km ?? 30

  // FUNCTION-TITLE-1 is superseded by LEADS-EERSTE-CALL-1: the client no longer
  // seeds a function filter from vacancy.category at all — the server's own
  // resolver applies the vacancy's match criteria and reports them back in the
  // response's `criteria` block, which is the one source the controls display.

  const [radiusKm, setRadiusKmState]      = useState(defaultRadiusKm)
  // LEADS-EERSTE-CALL-1 (BE 3d6a92b1, supersedes LEADS-PARITY-1's display rule):
  // the FIRST request sends NO filter params at all, so the server applies its
  // own MatchCriteriaResolver — the same criteria the leads counter used — and
  // the response's `criteria` block drives what the controls DISPLAY. A param
  // only rides along once the user actually touches its control.
  const [radiusTouched, setRadiusTouched] = useState(false)
  const setRadiusKm = (km: number) => { setRadiusKmState(km); setRadiusTouched(true) }
  const [functionsState, setFunctionsState] = useState<string[]>([])
  const [functionsTouched, setFunctionsTouched] = useState(false)
  // Tenant status/contract-form FORM defaults are deliberately NOT pre-applied
  // here any more: any prefilled param on the first call desyncs this tab from
  // the leads cell's population (the exact bug Danny reported: cell 6, tab 296).
  const [statusSel, setStatusSel]         = useState<string[]>([])
  const [contractForms, setContractForms] = useState<string[]>([])
  // The server's applied criteria (null until the first response lands).
  const [criteria, setCriteria] = useState<AppliedCriteria | null>(null)
  // Display selection: the user's explicit choice once touched, else the
  // server's applied criteria — so the chips/trigger honestly mirror the
  // filter that produced the visible rows, never a client-side guess.
  const functions = functionsTouched ? functionsState : (criteria?.function_titles ?? [])
  const setFunctions = (next: string[]) => { setFunctionsState(next); setFunctionsTouched(true) }

  // The tab is NOT remounted when a different vacancy is opened (EntityDrawer only
  // keys its tab body by the active TAB id, not the entity) — re-derive the filter
  // defaults on a vacancy switch the same way VacancyDrawer resets its own local
  // state: compare against the previous id during render (React's documented
  // "adjust state during render" pattern), no extra effect needed.
  const [prevId, setPrevId] = useState<Id | undefined>(vacancy.id)
  if (vacancy.id !== prevId) {
    setPrevId(vacancy.id)
    setRadiusKmState(defaultRadiusKm)
    setRadiusTouched(false)
    setFunctionsState([])
    setFunctionsTouched(false)
    setCriteria(null)
    setStatusSel([])
    setContractForms([])
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
  // SHOWN-OF-1: the eligible pool the endpoint scored against (MatchExplorerService's
  // capInfo, MatchExplorerController.php:32-35: "scoring is capped, the teller is
  // not") — null until a response has landed, so the tab never renders "of 0".
  const [eligibleTotal, setEligibleTotal] = useState<number | null>(null)

  const lat = toCoord(vacancy.lat)
  const lng = toCoord(vacancy.lng)
  const noLocation = lat == null || lng == null

  // Pending rematch poll timer — a ref so it
  // survives re-renders and can be cancelled both from refreshAdvice() (a second
  // click) and the fetch effect's own cleanup below (unmount, or a param change
  // that already triggers a fresh fetch of its own).
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch on any param change; abortable so a fast filter edit never lets a
  // superseded response overwrite the latest one (§9 alive-guard).
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/vacancies/${vacancy.id}/candidate-matches`, {
      params: {
        // GEO-DEGRADE-1: a radius needs an origin — without the vacancy's own geocode
        // the server still scores and ranks (measured: 37 rows, distance null), so
        // only the radius is dropped instead of killing the whole tab.
        // LEADS-PARITY-1: send `radius` only once the user actually changed the
        // control — an untouched default request omits it so the server applies
        // its own resolver default (CMBE parity fix), matching the leads counter
        // on the untouched population; an explicit radius still widens/narrows.
        ...(noLocation || !radiusTouched ? {} : { radius: radiusKm }),
        ...(statusSel.length && { status: statusSel }),
        ...(functionsTouched && functionsState.length ? { function_title: functionsState } : {}),
        ...(contractForms.length && { contract_form: contractForms }),
        per_page: 100,
      },
      signal: ctrl.signal,
    })
      .then(res => {
        // Tolerant envelope unwrap (the endpoint serves a standard paginator).
        const { rows: list, total } = unwrapList<RawMatchRow>(res)
        // SHOWN-OF-1: cap.eligible_total rides alongside the paginator body
        // (MatchExplorerController.php:35, `$page->toArray() + ['cap' => …]`),
        // read tolerantly since it sits outside the standard list envelope.
        const rawCap = (res as { data?: { cap?: { eligible_total?: unknown } } })?.data?.cap
        // Tolerant numeric read (no || coercion: a real "0" must stay 0); when
        // the cap block is absent, fall back to the paginator total unwrapList
        // already returns — both are honest population totals.
        const capNum = Number(rawCap?.eligible_total)
        const eligible = rawCap?.eligible_total != null && Number.isFinite(capNum)
          ? capNum
          : (Number.isFinite(Number(total)) && total > 0 ? total : null)
        setEligibleTotal(eligible)
        // LEADS-CIRKEL-1: tolerant read of the applied-criteria block (absent on
        // older backends -> null, the controls then simply show nothing extra).
        const rawCrit = (res as { data?: { criteria?: Record<string, unknown> } })?.data?.criteria
        if (rawCrit && typeof rawCrit === 'object') {
          const radiusNum = Number(rawCrit.radius_km)
          const expNum = Number(rawCrit.expiring_within_days)
          setCriteria({
            function_titles: Array.isArray(rawCrit.function_titles) ? rawCrit.function_titles.filter((x): x is string => typeof x === 'string') : [],
            radius_km: rawCrit.radius_km != null && Number.isFinite(radiusNum) ? radiusNum : null,
            geo_missing: Boolean(rawCrit.geo_missing),
            include_expiring_matches: Boolean(rawCrit.include_expiring_matches),
            expiring_within_days: rawCrit.expiring_within_days != null && Number.isFinite(expNum) ? expNum : null,
          })
        }
        const mapped: CandidateSearchRow[] = list.map(m => {
          const c = m.candidate ?? {}
          const scoreData = mapSearchHit(m, c)
          return {
            id: c.id ?? '',
            name: c.name ?? '?',
            city: c.city ?? '',
            functionTitle: c.function_title ?? '',
            status: lookupValue(c.status),
            statusLabel: c.status_label ?? '',
            statusColor: c.status_color ?? null,
            lat: scoreData.lat,
            lng: scoreData.lng,
            distanceKm: scoreData.distanceKm,
            score: scoreData.score,
            criteria: scoreData.criteria,
            aiAdvised: scoreData.aiAdvised,
            aiAdviceReason: scoreData.aiAdviceReason,
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
  }, [noLocation, vacancy.id, radiusKm, radiusTouched, functionsState, functionsTouched, statusSel, contractForms, reloadKey])

  // REMATCH-KNOP-1 (Danny 18-09 19:3x, on this tab's refresh button: the workflow he expects is
  // "Leads herberekenen (één vacature)"). Measured before the change: the old refresh-advice route
  // started koios_advice_vacancy (an AI call on real credits) and the seeded single-vacancy recount
  // template had never run once. The button now starts THAT template with this vacancy as subject
  // (POST /workflows/{id}/run, the S1 subject contract; step 1 is Ophalen with from_trigger), then
  // polls the run until it is terminal and reloads the list — GEO-POLL-1: until the result lands or
  // an honest cap, with backoff. The AI advice stays reachable from the Workflows page
  // (koios_advice_vacancy manual / bulk / on_update).
  // The tenant's active row of the seeded template, by template_key on the list row.
  const findRematchWorkflowId = async (): Promise<string | 'missing' | 'failed'> => {
    try {
      const list = await api.get('/workflows', { params: { per_page: 200 } })
      const rows = (list?.data?.data ?? []) as Array<{ id: string | number; template_key?: string | null; status?: string | null; active?: boolean }>
      const wf = rows.find(w => w.template_key === REMATCH_TEMPLATE_KEY && (w.status === 'active' || w.active === true))
      return wf ? String(wf.id) : 'missing'
    } catch {
      return 'failed'
    }
  }

  const rematch = async (): Promise<RematchOutcome> => {
    const workflowId = await findRematchWorkflowId()
    if (workflowId === 'missing' || workflowId === 'failed') return workflowId
    let runId: string | number | undefined
    try {
      const res = await api.post(`/workflows/${workflowId}/run`,
        { subject: { entity_type: 'vacancy', entity_id: String(vacancy.id) } },
        { quietStatuses: [409, 422], baseURL: resolveWorkflowBaseURL() })
      runId = (res?.data?.run?.id ?? res?.data?.data?.id ?? res?.data?.id) as string | number | undefined
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { status?: string } } }
      if (err?.response?.status === 409) return 'busy'
      if (err?.response?.status === 422 && err.response.data?.status === 'budget_exceeded') return 'budget'
      return 'failed'
    }
    // Poll the run with backoff (≈90 s cap); a terminal status or the cap reloads the list once.
    // Same ref the effect cleanup clears, so a filter change or unmount cancels the poll.
    const delays = [2000, 3000, 5000, 8000, 13000, 20000, 20000, 20000]
    let step = 0
    const tick = async () => {
      let done = step >= delays.length || runId == null
      if (!done) {
        try {
          const run = await api.get(`/workflow-runs/${runId}`, { baseURL: resolveWorkflowBaseURL() })
          const status = (run?.data?.data ?? run?.data)?.status as string | undefined
          done = !!status && TERMINAL.has(status)
        } catch { done = true }
      }
      if (done) { refreshTimerRef.current = null; setReloadKey(k => k + 1); return }
      refreshTimerRef.current = setTimeout(tick, delays[step++])
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(tick, delays[step++])
    return 'started'
  }

  // Radius display mirrors the same rule: untouched -> the server's applied
  // radius (criteria.radius_km), falling back to the tenant default until the
  // first response lands; touched -> the user's own value (which is also sent).
  const displayRadiusKm = radiusTouched ? radiusKm : (criteria?.radius_km ?? defaultRadiusKm)

  return {
    rows, loading, error, retry: () => setReloadKey(k => k + 1),
    radiusKm: displayRadiusKm, setRadiusKm,
    criteria,
    functions, setFunctions,
    statuses: statusSel, setStatuses: setStatusSel,
    contractForms, setContractForms,
    noLocation,
    rematch,
    eligibleTotal,
  }
}
