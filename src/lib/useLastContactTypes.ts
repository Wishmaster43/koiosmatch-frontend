/**
 * useLastContactTypes — tenant-configurable last-contact channel lookup.
 *
 * Fed by the API (GET /last-contact-types → {value,label,...}) with a seed default
 * (Email / Phone / WhatsApp) as fallback while the endpoint is empty/unavailable.
 * Managed in Settings → Kandidaatlijsten → Contacttype (C-21 backend).
 *
 * `labelOf(value)` resolves a stored slug ("phone") to its label ("Telefonisch"),
 * matching on value OR label so it works whichever the candidate stores.
 */
import { useState, useEffect } from 'react'
import api from './api'
import type { LookupOption } from '@/types/common'

// Seed defaults (slugs English/stable; labels per-tenant, normally from the API).
export const DEFAULT_LAST_CONTACT_TYPES: LookupOption[] = [
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Telefonisch' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

export function useLastContactTypes() {
  const [types, setTypes] = useState<LookupOption[]>(DEFAULT_LAST_CONTACT_TYPES)

  useEffect(() => {
    api.get('/last-contact-types').then(r => {
      const d = ((r?.data?.data ?? r?.data ?? []) as LookupOption[]).filter(Boolean)
      if (d.length) setTypes(d)
    }).catch(() => {})
  }, [])

  // Resolve a stored value/slug to its label (R-2: tenant icon prefixes it).
  const labelOf = (value?: string | null): string => {
    const v = norm(value)
    if (!v) return ''
    const hit = types.find(x => norm(x.value) === v || norm(x.label) === v)
    if (!hit) return value ?? ''
    const icon = typeof hit.icon === 'string' && hit.icon ? `${hit.icon} ` : ''
    return `${icon}${hit.label}`
  }

  return { types, labelOf }
}
