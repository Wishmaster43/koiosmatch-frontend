/**
 * useNoteTypes — tenant-configurable note-category lookup.
 *
 * Fed by the API (GET /note-types → {value/name,label,color,...}) with a seed
 * default as fallback while the endpoint is empty/unavailable. Managed in
 * Settings → Note types (C-21 backend, mirrors last-contact-types/rejection-reasons).
 *
 * `labelOf` / `colorOf` resolve a stored value/slug to its label/colour, matching
 * on value OR label so it works whichever the note stores.
 */
import { useState, useEffect } from 'react'
import api from './api'
import type { LookupOption } from '@/types/common'

// Seed defaults. VALUES are the API slugs (mirror the backend note_types seed) — the old
// Dutch-label-as-value fallback made a note 422 ("type invalid") whenever the lookup hadn't
// loaded yet (smoke-suite catch, 2026-07-03). Labels stay NL for display.
export const DEFAULT_NOTE_TYPES: LookupOption[] = [
  { value: 'general',     label: 'Algemeen' },
  { value: 'intake',      label: 'Intake' },
  { value: 'feedback',    label: 'Feedback' },
  { value: 'appointment', label: 'Afspraak' },
  { value: 'followup',    label: 'Follow-up' },
  { value: 'warning',     label: 'Waarschuwing' },
  // System note the backend writes on every status/phase change (N-1) — seeded here
  // with a neutral slate so the "Statuswissel" chip resolves even before /note-types loads.
  { value: 'status_change', label: 'Statuswissel', color: '#64748B' },
  // Lifecycle events (archived/restored/trashed) the BE writes centrally (TIJDLIJN-LC-1).
  { value: 'lifecycle', label: 'Dossier', color: '#64748B' },
]

// Note types the backend writes automatically (not hand-authored) — rendered as a
// calm system-event row in the thread, never with an edit pencil (N-1-FE).
export const SYSTEM_NOTE_TYPES = new Set(['status_change', 'lifecycle'])

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

export function useNoteTypes() {
  const [types, setTypes] = useState<LookupOption[]>(DEFAULT_NOTE_TYPES)

  // Load the tenant lookup once; keep the seed if the endpoint is empty/unavailable.
  useEffect(() => {
    api.get('/note-types').then(r => {
      const raw = (r?.data?.data ?? r?.data ?? []) as Record<string, unknown>[]
      const d = raw.filter(Boolean).map(toOption)
      if (d.length) setTypes(d)
    }).catch(() => {})
  }, [])

  // Resolve a stored value/slug to its label/colour; fall back to the raw value.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  // Composer options: system-written categories (Statuswissel) are never offered
  // as a writable type — the seeded lookup DOES contain them for display resolution.
  const writableTypes = types.filter(nt => !SYSTEM_NOTE_TYPES.has(nt.value))

  return { types, writableTypes, labelOf, colorOf }
}
