/**
 * useDocumentTypes — tenant-configurable document-type lookup (colour + icon).
 *
 * Fed by the API (GET /document-types → {value/name,label,color,icon,...}) with a
 * seed default as fallback while the endpoint is empty/unavailable. Managed in
 * Settings → Document types (mirrors rejection-reasons: name + colour + reorder;
 * DOCTYPE-ICON-1 adds a per-type `icon`, editable in the same Settings screen).
 *
 * The colour drives the document tile + soft chip in the Documents tab, so it
 * replaces the old hardcoded DOC_TYPES / DOC_COLORS constants. The icon (a lucide
 * slug from the curated DOC_TYPE_ICON_MAP below) drives the tile's glyph so every
 * document type stands out instead of a single generic FileText everywhere.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * V20b entity scope: an optional `entity` ('candidate' | 'vacancy' | 'customer')
 * narrows the request to `?entity=<x>` (backend: that entity's own types PLUS the
 * global/NULL-entity ones). Omitted, behaviour is unchanged (the plain unscoped
 * endpoint, same as before this axis existed). useCachedLookup's module-scope
 * cache is keyed by its `url` argument alone (it lives outside this file and isn't
 * touched here) — the entity is baked straight into that url string
 * (`/document-types?entity=vacancy`) rather than passed as a separate axios
 * `params` object, so each entity variant naturally gets its OWN cache entry.
 * Without this, a bare-URL-keyed cache would serve one entity's list to every
 * other entity's consumer (e.g. the candidate screen's fetch would leak into the
 * customer screen) — this is the one lever available here to prevent that.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import type { LucideIcon } from 'lucide-react'
import { FileText, IdCard, GraduationCap, FileSignature, ShieldCheck, BadgeCheck, Image, File } from 'lucide-react'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// Seed defaults (labels NL, colours = the previous DOC_COLORS map, icons = the
// backend's DOCTYPE-ICON-1 seed) — API overrides per tenant.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_DOCUMENT_TYPES: LookupOption[] = [
  { value: 'CV',          label: 'CV',          color: 'var(--color-secondary)', icon: 'file-text' },
  { value: 'ID-bewijs',   label: 'ID-bewijs',   color: '#8B5CF6',                icon: 'id-card' },
  { value: 'Diploma',     label: 'Diploma',     color: 'var(--color-warning)',   icon: 'graduation-cap' },
  { value: 'Contract',    label: 'Contract',    color: '#059669',                icon: 'file-signature' },
  // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
  { value: 'VOG',         label: 'VOG',         color: 'var(--color-danger)',    icon: 'shield-check' },
  { value: 'Certificaat', label: 'Certificaat', color: '#EC4899',                icon: 'badge-check' },
  { value: 'Foto',        label: 'Foto',        color: 'var(--color-info)',      icon: 'image' },
  { value: 'Overig',      label: 'Overig',      color: '#6B7280',                icon: 'file' },
]
/* eslint-enable no-restricted-syntax */

// Curated lucide set for document-type tiles (DOCTYPE-ICON-1). Keys MUST match the
// backend seed's `icon` values exactly (verified real lucide-react exports — e.g.
// IdCard, not CreditCard). The Settings icon picker offers this same curated set.
export const DOC_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  'file-text': FileText,
  'id-card': IdCard,
  'graduation-cap': GraduationCap,
  'file-signature': FileSignature,
  'shield-check': ShieldCheck,
  'badge-check': BadgeCheck,
  image: Image,
  file: File,
}
// Stable, curated order for the Settings icon-picker grid.
export const DOC_TYPE_ICON_NAMES = Object.keys(DOC_TYPE_ICON_MAP)

// Resolve a stored icon slug to its lucide component — unknown/empty/null never
// crashes, it just falls back to the generic FileText glyph.
export function resolveDocTypeIcon(name?: string | null): LucideIcon {
  const key = (name ?? '').trim().toLowerCase()
  return DOC_TYPE_ICON_MAP[key] ?? FileText
}

// eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
const FALLBACK_COLOR = '#6B7280'
const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// Normalise an API row (id/name/label/value/color/icon) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? FALLBACK_COLOR,
  icon: (r.icon as string) ?? null,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapDocumentTypes = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (unwrapList(res).rows) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(toOption)
  return d.length ? d : null
}

export function useDocumentTypes(entity?: string) {
  const { t } = useTranslation('common')
  // Bake the optional entity filter into the cache key itself (see file header) —
  // no entity = the exact same request/url as before this axis existed.
  const url = entity ? `/document-types?entity=${encodeURIComponent(entity)}` : '/document-types'
  const { data: rawTypes } = useCachedLookup(url, mapDocumentTypes, DEFAULT_DOCUMENT_TYPES)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const types = useMemo(() => translateSeedList(t, 'documentTypes', rawTypes), [rawTypes, t])

  // Resolve a stored value/slug to its label/colour/icon; fall back to raw value / neutral grey.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string => find(value)?.color ?? FALLBACK_COLOR
  // The type's configured icon slug, or null — resolveDocTypeIcon owns the fallback.
  const iconOf = (value?: string | null): string | null => (find(value)?.icon as string | undefined) ?? null

  return { types, labelOf, colorOf, iconOf }
}
