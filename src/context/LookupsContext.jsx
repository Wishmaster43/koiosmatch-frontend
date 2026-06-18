import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

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
  { value: 'on_call',     label: 'Oproepkracht',  color: '#1B60A9' },
  { value: 'freelance',   label: 'ZZP',           color: '#0F766E' },
  { value: 'payroll',     label: 'Payroll',       color: '#7C3AED' },
  { value: 'temp_agency', label: 'Uitzendkracht', color: '#B45309' },
  { value: 'secondment',  label: 'Detachering',   color: '#0369A1' },
  { value: 'on_demand',   label: 'Demand',        color: '#BE185D' },
]

export const DEFAULT_FUNNEL_TYPES = [
  { value: 'prospect', label: 'Prospect',     color: '#6B7280' },
  { value: 'intake',   label: 'Intake',       color: '#8B5CF6' },
  { value: 'pool',     label: 'Actieve pool', color: '#16A34A' },
  { value: 'alumni',   label: 'Alumni',       color: '#0EA5E9' },
]

export const DEFAULT_STATUSES = [
  { value: 'prospect', label: 'Prospect',     color: '#9CA3AF' },
  { value: 'intake',   label: 'Intake',       color: '#8B5CF6' },
  { value: 'active',   label: 'Actief',       color: '#16A34A' },
  { value: 'inactive', label: 'Niet actief',  color: '#D97706' },
  { value: 'sick',     label: 'Ziek',         color: '#DC2626' },
  { value: 'leave',    label: 'Verlof',       color: '#0EA5E9' },
  { value: 'external', label: 'Extern',       color: '#F0AB00' },
  { value: 'blocked',  label: 'Geblokkeerd',  color: '#991B1B' },
  { value: 'outflow',  label: 'Uitgestroomd', color: '#9CA3AF' },
  { value: 'deleted',  label: 'Verwijderd',   color: '#9CA3AF' },
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
    if (!localStorage.getItem('auth_token')) { setLoading(false); return }
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
