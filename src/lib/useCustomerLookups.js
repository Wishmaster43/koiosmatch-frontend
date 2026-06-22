/**
 * useCustomerLookups — tenant-configurable customer lookups (statuses for now).
 *
 * Mirrors useGenders/LookupsContext: fed by the API
 * (GET /settings/customer-lookups → { statuses: Item[] }) with a seed default as
 * fallback while the API is empty/unavailable. Managed in Settings → Customers →
 * Statuses. NOT a hardcoded enum — each tenant configures values/labels/colours.
 *
 * Item = { value, label, color?, order?, active? }
 */
import { useState, useEffect } from 'react'
import api from './api'
import { COOKIE_AUTH } from './authMode'

// Seed defaults — the values shipped for new tenants and the fallback before the
// backend is ready. Colours match the calm light/dark scheme used across lookups.
export const DEFAULT_CUSTOMER_STATUSES = [
  { value: 'actief',      label: 'Actief',      color: '#16A34A' },
  { value: 'prospect',    label: 'Prospect',    color: '#1B60A9' },
  { value: 'inactief',    label: 'Inactief',    color: '#D97706' },
  { value: 'geblokkeerd', label: 'Geblokkeerd', color: '#DC2626' },
]

// Normalise a raw API list: keep active items, sort by order, fall back to seed.
function normalize(raw, fallback) {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw
    .filter(it => it.active !== false)
    .sort((a, b) => (a.order ?? a.sort_order ?? a.position ?? 0) - (b.order ?? b.sort_order ?? b.position ?? 0))
    .map(it => ({ value: it.value ?? it.id, label: it.label ?? it.name ?? it.value, color: it.color ?? '#6B7280' }))
}

export function useCustomerLookups() {
  const [statuses, setStatuses] = useState(DEFAULT_CUSTOMER_STATUSES)
  const [loading,  setLoading]  = useState(true)

  // Load the tenant config once; cookie mode has no JS-visible token so just try.
  useEffect(() => {
    if (!COOKIE_AUTH && !localStorage.getItem('auth_token')) { setLoading(false); return }
    api.get('/settings/customer-lookups')
      .then(res => { const d = res.data?.data ?? res.data ?? {}; setStatuses(normalize(d.statuses, DEFAULT_CUSTOMER_STATUSES)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // value → item helper with a neutral fallback so the UI never crashes.
  const statusMeta = (v) => statuses.find(s => s.value === v) ?? { value: v, label: v || '—', color: '#9CA3AF' }

  return { statuses, statusMeta, loading }
}
