// Shared field-shape types for StatusListEditor (SIZE-SPLIT-B extraction, zero
// behaviour change) — see the module doc comment in StatusListEditor.tsx for
// the full prose explanation of each optional field.
import type { ReactNode } from 'react'

// Fallback swatch colour for a lookup row without one stored yet — shared by
// StatusListRow and StatusListModal so the two never drift apart.
// eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
export const FALLBACK_SWATCH = '#6B7280'

export interface StatusListItem {
  id: string | number
  name?: string
  label?: string
  value?: string
  color?: string
  icon?: string
  in_use?: boolean
  is_used?: boolean
  locked?: boolean
  usage_count?: number
  candidates_count?: number
  [key: string]: unknown
}

export interface ExtraFieldDef {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
  default?: unknown
  // NATION-FLAG-1: suppress extraField's own generic text badge in the row —
  // for a lookup that renders its extraField value a different way (rowPrefix).
  hideRowBadge?: boolean
}

export interface FlagFieldDef {
  key: string
  label: string
  description?: string
  default?: boolean
}

export interface NumberFieldDef {
  key: string
  label: string
  default?: number | null
  min?: number
  max?: number
  suffix?: string
}

export interface DefaultFieldDef {
  key?: string
  field?: string
  labelKey?: string
}

export interface IconPickerDef {
  icons: string[]
  // Matches resolveGenericLookupIcon / IconPickerControl's own contract:
  // resolve(slug) → a LucideIcon component (untyped .jsx, so `unknown` here).
  resolve: (slug?: string | null) => unknown
}

export interface StatusListEditorProps {
  title: ReactNode
  subtitle?: ReactNode
  endpoint: string
  addLabel: ReactNode
  withColor?: boolean
  compact?: boolean
  extraField?: ExtraFieldDef | null
  flagField?: FlagFieldDef | null
  flagFields?: FlagFieldDef[] | null
  numberField?: NumberFieldDef | null
  defaultField?: DefaultFieldDef | null
  defaultFields?: DefaultFieldDef[] | null
  withIcon?: boolean
  iconPicker?: IconPickerDef | null
  allowAdd?: boolean
  showRank?: boolean
  entity?: string | null
  fetchEntity?: string | null
  postFilter?: ((item: StatusListItem) => boolean) | null
  notFoundNotice?: ReactNode
  withValueSlug?: boolean
  reorderable?: boolean
  rowPrefix?: ((item: StatusListItem) => ReactNode) | null
  // System values (phases): rename/colour/order allowed, never add or delete.
  locked?: boolean
}

export type StatusListDraft = Record<string, unknown> & { name: string; color?: string }
