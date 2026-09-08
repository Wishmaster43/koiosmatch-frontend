/**
 * buildLookupHelpers — factory for lookup resolver functions (find/labelOf/colorOf/iconOf).
 * Eliminates duplicate resolver patterns in useCao, useDocumentTypes, useNoteTypes.
 * Takes a lookup list and optional normalizer, returns an object with resolver functions.
 */
import type { LookupOption } from '@/types/common'

export interface LookupHelpers {
  find: (value?: string | null) => LookupOption | undefined
  labelOf: (value?: string | null) => string
  colorOf: (value?: string | null) => string | undefined
  iconOf: (value?: string | null) => string | null
}

/**
 * Build resolver functions for a lookup list, using optional normalization
 * (e.g., case-insensitive matching via a toLowerCase/trim function).
 */
export function buildLookupHelpers(
  types: LookupOption[],
  norm?: (value: unknown) => string,
): LookupHelpers {
  const normalizer = norm || ((s?: unknown) => (s ?? '').toString().trim().toLowerCase())

  // Resolve a stored value/slug to its lookup option by matching against value or label.
  const find = (value?: string | null): LookupOption | undefined => {
    const v = normalizer(value)
    return v ? types.find(x => normalizer(x.value) === v || normalizer(x.label) === v) : undefined
  }

  // Resolve a value to its label, falling back to the raw value if not found.
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''

  // Resolve a value to its color, returning undefined if not found.
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  // Resolve a value to its icon slug (optional — only present if types carry icon field).
  const iconOf = (value?: string | null): string | null => {
    const opt = find(value)
    return (opt && 'icon' in opt && opt.icon) ? (opt.icon as string) : null
  }

  return { find, labelOf, colorOf, iconOf }
}
