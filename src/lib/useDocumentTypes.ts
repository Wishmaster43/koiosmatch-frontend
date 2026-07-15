/**
 * useDocumentTypes — tenant-configurable document-type lookup (with colour).
 *
 * Fed by the API (GET /document-types → {value/name,label,color,...}) with a seed
 * default as fallback while the endpoint is empty/unavailable. Managed in
 * Settings → Document types (mirrors rejection-reasons: name + colour + reorder).
 *
 * The colour drives the document tile + soft chip in the Documents tab, so it
 * replaces the old hardcoded DOC_TYPES / DOC_COLORS constants.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'

// Seed defaults (labels NL, colours = the previous DOC_COLORS map) — API overrides per tenant.
export const DEFAULT_DOCUMENT_TYPES: LookupOption[] = [
  { value: 'CV',          label: 'CV',          color: 'var(--color-secondary)' },
  { value: 'ID-bewijs',   label: 'ID-bewijs',   color: '#8B5CF6' },
  { value: 'Diploma',     label: 'Diploma',     color: 'var(--color-warning)' },
  { value: 'Contract',    label: 'Contract',    color: '#059669' },
  { value: 'VOG',         label: 'VOG',         color: 'var(--color-danger)' },
  { value: 'Certificaat', label: 'Certificaat', color: '#EC4899' },
  { value: 'Overig',      label: 'Overig',      color: '#6B7280' },
]

const FALLBACK_COLOR = '#6B7280'
const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? FALLBACK_COLOR,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapDocumentTypes = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (res?.data?.data ?? res?.data ?? []) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(toOption)
  return d.length ? d : null
}

export function useDocumentTypes() {
  const { data: types } = useCachedLookup('/document-types', mapDocumentTypes, DEFAULT_DOCUMENT_TYPES)

  // Resolve a stored value/slug to its label/colour; fall back to raw value / neutral grey.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string => find(value)?.color ?? FALLBACK_COLOR

  return { types, labelOf, colorOf }
}
