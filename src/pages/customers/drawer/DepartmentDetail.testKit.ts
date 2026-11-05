/** DepartmentDetail test kit · shared status lookup fixture (split from DepartmentDetail.test.tsx). */
import type { LookupOption } from '@/types/common'

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
// Lowercase (jsdom lowercases hex inside a color-mix() string on serialization, so
// a mixed-case fixture would never match chipInk's own computed output).
export const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22c55e', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9ca3af', id: 'status-inactive' },
]
