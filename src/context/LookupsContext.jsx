import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { COOKIE_AUTH } from '../lib/authMode'

/**
 * LookupsContext — the tenant-configurable candidate lookups.
 *
 * Three separate layers (a mature flex-staffing ATS keeps these apart):
 *   1. candidateTypes — contract form, MULTI-value per candidate (oproepkracht,
 *      zzp, payroll, uitzend, detachering, demand). Rarely changes.
 *   2. funnelTypes    — acquisition phase, single value (prospect → intake →
 *      pool → alumni). Changes once-ish per candidate.
 *   3. statuses       — operational status, single value with a colour
 *      (actief, ziek, verlof, geblokkeerd, …). Changes often.
 *
 * These are NOT hardcoded enums: each tenant configures the values/labels/colours
 * in Settings. The defaults below are the seed shipped for new tenants and the
 * fallback while the API call is in flight / before the backend is ready.
 *
 * Backend contract: GET /settings/candidate-lookups
 *   → { candidate_types: Item[], funnel_types: Item[], statuses: Item[] }
 *   Item = { value, label, color?, order?, active? }
 */

// ── Seed defaults ───────────────────────────────────────────────────────────

// Slugs zijn Engels/stabiel (matchen de backend); labels/kleuren zijn per tenant
// instelbaar en komen normaal uit GET /settings/candidate-lookups.
export const DEFAULT_CANDIDATE_TYPES = [
  { value: 'on_call',     label: 'Oproepkracht',  color: '#6E8FD6' },
  { value: 'freelance',   label: 'ZZP',           color: '#5FB0AC' },
  { value: 'payroll',     label: 'Payroll',       color: '#A98AD1' },
  { value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' },
  { value: 'secondment',  label: 'Detachering',   color: '#6FA8C4' },
  { value: 'on_demand',   label: 'Demand',        color: '#C98BBA' },
]

export const DEFAULT_FUNNEL_TYPES = [
  { value: 'prospect', label: 'Prospect',     color: '#94A3B8' },
  { value: 'intake',   label: 'Intake',       color: '#8C86D9' },
  { value: 'pool',     label: 'Actieve pool', color: '#79B58E' },
  { value: 'alumni',   label: 'Alumni',       color: '#6FA8C4' },
]

export const DEFAULT_STATUSES = [
  { value: 'prospect', label: 'Prospect',     color: '#94A3B8' },
  { value: 'intake',   label: 'Intake',       color: '#8C86D9' },
  { value: 'active',   label: 'Actief',       color: '#79B58E' },
  { value: 'inactive', label: 'Niet actief',  color: '#C9AC64' },
  { value: 'sick',     label: 'Ziek',         color: '#D98A8A' },
  { value: 'leave',    label: 'Verlof',       color: '#6FA8C4' },
  { value: 'external', label: 'Extern',       color: '#DDA071' },
  { value: 'blocked',  label: 'Geblokkeerd',  color: '#B96B6B' },
  { value: 'outflow',  label: 'Uitgestroomd', color: '#8A94A6' },
  { value: 'deleted',  label: 'Verwijderd',   color: '#64748B' },
]

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
function normalize(raw, fallback) {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw
    .filter(it => it.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(it => ({ value: it.value, label: it.label ?? it.value, color: it.color ?? '#6B7280' }))
}

const LookupsContext = createContext(null)

export function LookupsProvider({ children }) {
  const [candidateTypes, setCandidateTypes] = useState(DEFAULT_CANDIDATE_TYPES)
  const [funnelTypes,    setFunnelTypes]    = useState(DEFAULT_FUNNEL_TYPES)
  const [statuses,       setStatuses]       = useState(DEFAULT_STATUSES)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    // Cookie mode has no JS-visible token — let the request go and rely on 401.
    if (!COOKIE_AUTH && !localStorage.getItem('auth_token')) { setLoading(false); return }
    api.get('/settings/candidate-lookups')
      .then(res => {
        const d = res.data ?? {}
        setCandidateTypes(normalize(d.candidate_types, DEFAULT_CANDIDATE_TYPES))
        setFunnelTypes(normalize(d.funnel_types, DEFAULT_FUNNEL_TYPES))
        setStatuses(normalize(d.statuses, DEFAULT_STATUSES))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // value → item helpers (with a neutral fallback so the UI never crashes).
  const find = (list, value) => list.find(i => i.value === value)
  const typeMeta   = (v) => find(candidateTypes, v) ?? { value: v, label: v, color: '#6B7280' }
  const funnelMeta = (v) => find(funnelTypes, v)    ?? { value: v, label: v, color: '#6B7280' }
  const statusMeta = (v) => find(statuses, v)       ?? { value: v, label: v, color: '#9CA3AF' }

  return (
    <LookupsContext.Provider value={{
      candidateTypes, funnelTypes, statuses, loading,
      typeMeta, funnelMeta, statusMeta,
    }}>
      {children}
    </LookupsContext.Provider>
  )
}

export function useLookups() {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups must be used within a LookupsProvider')
  return ctx
}
