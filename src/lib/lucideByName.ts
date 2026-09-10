/**
 * lucideByName — resolves a lucide icon NAME from an API contract (kebab-case, e.g.
 * `building-2`, `sliders-horizontal`) to its component, so the FE hardcodes no icon
 * table for server-declared surfaces (CATALOG-GROUPS-1: section icons and group icons
 * ride in GET /settings/catalog). Unknown or empty names fall back to the given default.
 */
import * as Lucide from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// `bar-chart-3` → `BarChart3`, `id-card` → `IdCard`: lucide's export names are PascalCase of the kebab name.
const toPascal = (name: string) => name.split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')

// The component for a contract icon name, or the fallback when the name is unknown. The
// namespace (not the `icons` map) is read on purpose: it also carries lucide's ALIAS
// names (`bar-chart-3` → BarChart3 → ChartColumn), which a contract may still use.
export function lucideByName(name: string | null | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback
  const found = (Lucide as unknown as Record<string, unknown>)[toPascal(name)]
  return isIcon(found) ? found : fallback
}

// A lucide component is a forwardRef object (or a function) — never a string or a plain map.
const isIcon = (v: unknown): v is LucideIcon => (typeof v === 'object' && v !== null && '$$typeof' in v) || typeof v === 'function'
