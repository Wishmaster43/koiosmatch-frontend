import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

/**
 * LookupsContext — the tenant-configurable candidate lookups.
 *
 * Three separate layers (a mature flex-staffing ATS keeps these apart):
 *   1. candidateTypes — contract form, MULTI-value per candidate (oproepkracht,
 *      zzp, payroll, uitzend, detachering, demand). Rarely changes.
 *   2. funnelTypes    — application pipeline phase, single value PER APPLICATION
 *      (applied → invited/intake → proposal → hired → rejected). Lives on the
 *      application; on the candidate only as read-only chips (move = B-10/C-10).
 *   3. statuses       — person lifecycle, single value with a colour
 *      (lead → candidate → placed → inactive). Driven by funnel automation
 *      (hired → placed); availability (sick/leave) is a separate axis.
 *
 * These are NOT hardcoded enums: each tenant configures the values/labels/colours
 * in Settings. The defaults below are the seed shipped for new tenants and the
 * fallback while the API call is in flight / before the backend is ready.
 *
 * Backend contract: GET /settings/candidate-lookups
 *   → { candidate_types: Item[], funnel_types: Item[], statuses: Item[] }
 *   Item = { value, label, color?, order?, active? }
 */

// One configurable lookup row. Flag semantics (§3B — flag-driven, never label-matched):
// statuses carry requires_match/requires_reason/expects_return_date; statuses + funnel
// carry is_applicant; funnel carries requires_appointment. Index signature keeps it
// structurally compatible with the shared LookupOption.
export interface LookupItem {
  value: string; label: string; color: string
  is_applicant?: boolean; requires_appointment?: boolean; is_default?: boolean
  requires_match?: boolean; requires_reason?: boolean; expects_return_date?: boolean; is_blacklist?: boolean
  [k: string]: unknown
}

interface LookupsValue {
  candidateTypes: LookupItem[]
  phases: LookupItem[]
  funnelTypes: LookupItem[]
  statuses: LookupItem[]
  availability: LookupItem[]
  loading: boolean
  typeMeta: (v?: string | null) => LookupItem
  phaseMeta: (v?: string | null) => LookupItem
  funnelMeta: (v?: string | null) => LookupItem
  statusMeta: (v?: string | null) => LookupItem
  availabilityMeta: (v?: string | null) => LookupItem
}

// ── Seed defaults ───────────────────────────────────────────────────────────

// Slugs are English/stable (they match the backend); labels/colours are
// per-tenant configurable and normally come from GET /settings/candidate-lookups.
export const DEFAULT_CANDIDATE_TYPES: LookupItem[] = [
  { value: 'on_call',     label: 'Oproepkracht',  color: '#6E8FD6' },
  { value: 'freelance',   label: 'ZZP',           color: '#5FB0AC' },
  { value: 'payroll',     label: 'Payroll',       color: '#A98AD1' },
  { value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' },
  { value: 'secondment',  label: 'Detachering',   color: '#6FA8C4' },
  { value: 'on_demand',   label: 'Demand',        color: '#C98BBA' },
]

// Phase = relationship lifecycle (single value), seed Lead → Candidate. NEW axis
// (model v2, split out of the old "status"). Lead → Candidate via automation.
export const DEFAULT_PHASES: LookupItem[] = [
  { value: 'lead',      label: 'Lead',      color: '#94A3B8', is_default: true },
  { value: 'candidate', label: 'Kandidaat', color: '#79B58E' },
]

// Application pipeline (per application). `invited` is the intake stage that
// carries `requires_appointment` once configured (see §3B / C-22).
export const DEFAULT_FUNNEL_TYPES: LookupItem[] = [
  { value: 'applied',  label: 'Gesolliciteerd',     color: '#94A3B8' },
  { value: 'invited',  label: 'Uitgenodigd/Intake', color: '#8C86D9', requires_appointment: true },
  { value: 'proposal', label: 'Voorgesteld',        color: '#6FA8C4' },
  { value: 'hired',    label: 'Aangenomen',         color: '#79B58E' },
  { value: 'rejected', label: 'Afgewezen',          color: '#D98A8A' },
]

// Deployability / "status" (single value), model v2 (decision 2026-06-29): "can I
// deploy them now?". Absorbs the old availability axis. `placed` requires a linked
// Match; `blacklist` is a status value (not a separate flag) that asks for a reason.
// Lead/Candidate moved to PHASES.
export const DEFAULT_STATUSES: LookupItem[] = [
  { value: 'available',   label: 'Beschikbaar',      color: '#79B58E' },
  { value: 'placed',      label: 'Geplaatst',        color: '#6E8FD6', requires_match: true },
  // Flags MUST mirror the backend guard (CandidateStatusGuard): sick/leave also require
  // a reason — a seed without it races the lookups fetch into a reason-less PATCH → 422
  // (caught by the cookie-mode smoke on the slower proxy, 2026-07-04).
  { value: 'unavailable', label: 'Niet beschikbaar', color: '#C9AC64', requires_reason: true, expects_return_date: true },
  { value: 'sick',        label: 'Ziek',             color: '#D98A8A', requires_reason: true, expects_return_date: true },
  { value: 'leave',       label: 'Verlof',           color: '#6FA8C4', requires_reason: true, expects_return_date: true },
  { value: 'blacklist',   label: 'Blacklist',        color: '#D14B4B', requires_reason: true, is_blacklist: true },
]

// Availability is a SEPARATE axis from the lifecycle status (a candidate can be
// "Sollicitant" and "Ziek" at once). Backed by /availability-options.
const DEFAULT_AVAILABILITY: LookupItem[] = [
  { value: 'available',   label: 'Beschikbaar',      color: '#79B58E' },
  { value: 'unavailable', label: 'Niet beschikbaar', color: '#8A94A6' },
  { value: 'sick',        label: 'Ziek',             color: '#D98A8A' },
  { value: 'leave',       label: 'Verlof',           color: '#6FA8C4' },
]

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
// ALL flag fields are carried through (§3B — flag-driven): is_applicant + funnel's
// requires_appointment (previously dropped here, breaking intake detection) alongside
// the status flags, so behaviour never falls back to matching hardcoded value keys.
function normalize(raw: unknown, fallback: LookupItem[]): LookupItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  // Flag resolution: an explicit API boolean wins; when the API OMITS the key entirely
  // (LookupItemResource doesn't emit requires_reason/requires_match/expects_return_date yet —
  // STATUS-1), fall back to the seed flags by value. Without this, "unavailable/sick/leave/
  // blacklist" lost their reason/return-date prompt → bare PATCH → 422 (2026-07-03).
  const flag = (it: Record<string, unknown>, key: keyof LookupItem): boolean => {
    if (typeof it[key] === 'boolean') return it[key] as boolean
    const seed = fallback.find(f => f.value === String(it.value))
    return seed?.[key] === true
  }
  return (raw as Record<string, unknown>[])
    .filter(it => it.active !== false)
    .sort((a, b) => (Number(a.order ?? a.sort_order ?? 0)) - (Number(b.order ?? b.sort_order ?? 0)))
    .map(it => ({ value: String(it.value), label: String(it.label ?? it.value), color: (it.color as string) ?? '#6B7280',
      requires_reason: flag(it, 'requires_reason'),
      requires_match: flag(it, 'requires_match'),
      expects_return_date: flag(it, 'expects_return_date'),
      is_applicant: flag(it, 'is_applicant'),
      requires_appointment: flag(it, 'requires_appointment'),
      is_blacklist: flag(it, 'is_blacklist'),
      is_default: flag(it, 'is_default') }))
}

const LookupsContext = createContext<LookupsValue | null>(null)

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [candidateTypes, setCandidateTypes] = useState<LookupItem[]>(DEFAULT_CANDIDATE_TYPES)
  const [phases,         setPhases]         = useState<LookupItem[]>(DEFAULT_PHASES)
  const [funnelTypes,    setFunnelTypes]    = useState<LookupItem[]>(DEFAULT_FUNNEL_TYPES)
  const [statuses,       setStatuses]       = useState<LookupItem[]>(DEFAULT_STATUSES)
  const [availability] = useState<LookupItem[]>(DEFAULT_AVAILABILITY)
  const [loading,        setLoading]        = useState(true)
  // Session state gates the fetch — providers mount before login (App shell order).
  const { user } = useAuth() ?? {}

  useEffect(() => {
    // No session yet → keep the seeds and stay quiet (no pre-login 401 in the console);
    // the effect re-runs the moment the user logs in (or switches tenant).
    if (!user) { setLoading(false); return }
    api.get('/settings/candidate-lookups')
      .then(res => {
        const d = res.data ?? {}
        setCandidateTypes(normalize(d.candidate_types, DEFAULT_CANDIDATE_TYPES))
        setPhases(normalize(d.phases, DEFAULT_PHASES))
        setFunnelTypes(normalize(d.funnel_types, DEFAULT_FUNNEL_TYPES))
        setStatuses(normalize(d.statuses, DEFAULT_STATUSES))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // C-39: availability was merged into the status axis (v2) and the
    // /availability-options endpoint was removed backend-side — keep the seed
    // default and stop fetching (kills the 404). Full removal of the axis is C-39.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch per login/tenant-switch
  }, [user?.id])

  // value → item helpers (with a neutral fallback so the UI never crashes).
  const find = (list: LookupItem[], value?: string | null) => list.find(i => i.value === value)
  const typeMeta   = (v?: string | null): LookupItem => find(candidateTypes, v) ?? { value: v ?? '', label: v ?? '', color: '#6B7280' }
  const phaseMeta  = (v?: string | null): LookupItem => find(phases, v)         ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }
  const funnelMeta = (v?: string | null): LookupItem => find(funnelTypes, v)    ?? { value: v ?? '', label: v ?? '', color: '#6B7280' }
  const statusMeta = (v?: string | null): LookupItem => find(statuses, v)       ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }
  const availabilityMeta = (v?: string | null): LookupItem => find(availability, v) ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }

  const value: LookupsValue = {
    candidateTypes, phases, funnelTypes, statuses, availability, loading,
    typeMeta, phaseMeta, funnelMeta, statusMeta, availabilityMeta,
  }

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}

export function useLookups(): LookupsValue {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups must be used within a LookupsProvider')
  return ctx
}
