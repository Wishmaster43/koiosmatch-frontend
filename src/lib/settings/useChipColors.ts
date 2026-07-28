/**
 * useChipColors — CHIPKLEUR-INSTELBAAR-1: resolves the tenant-configurable colours
 * for the customer drawer's Locatie/Afdeling contact chips. Backed by two settings
 * keys (`customer_location_chip_color`, `customer_department_chip_color`), each a
 * raw CSS colour — a hex literal or a `var(--color-*)` token — validated server-side
 * by the ChipColor rule (SettingController@store, CHIPKLEUR-INSTELBAAR-1).
 *
 * ABSENT MEANS "keep today's colour": nothing changes for a tenant until they save a
 * value in Settings. An empty string, whitespace-only value, or a missing/non-string
 * key all resolve to the same fallback the call sites hardcoded before this hook
 * existed (`var(--color-secondary)` / `var(--color-violet)`) — defensive by design,
 * since the settings blob is free-form JSON from the API.
 *
 * There is no shared string-getter in useAllSettings.ts yet (only getBoolSetting /
 * getJsonSetting / getNumberSetting), and that file is out of scope for this change,
 * so the same defensive-fallback shape lives here instead, scoped to these two keys
 * — mirrors useContactFunctions' use of useAllSettings + getBoolSetting.
 */
import { useAllSettings } from './useAllSettings'

// Documented fallbacks (SettingController.php, CHIPKLEUR-INSTELBAAR-1) — must match
// exactly so an absent setting renders identically to before this feature existed.
const DEFAULT_LOCATION_CHIP_COLOR = 'var(--color-secondary)'
const DEFAULT_DEPARTMENT_CHIP_COLOR = 'var(--color-violet)'

export interface ChipColors {
  location: string
  department: string
}

// A non-string, missing, or blank/whitespace-only value all mean "use the fallback" —
// never let a stray empty setting render an invalid/empty CSS colour on a chip.
function resolveChipColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  return trimmed === '' ? fallback : trimmed
}

export function useChipColors(): ChipColors {
  const settings = useAllSettings()
  return {
    location: resolveChipColor(settings['customer_location_chip_color'], DEFAULT_LOCATION_CHIP_COLOR),
    department: resolveChipColor(settings['customer_department_chip_color'], DEFAULT_DEPARTMENT_CHIP_COLOR),
  }
}
