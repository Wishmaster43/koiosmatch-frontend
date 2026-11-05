/** Shared DATA fixtures for the mapApplication suites (plain data, no mocks). */
import type { LookupItem } from '@/context/LookupsContext'

// A tenant that renamed the funnel: 'aangenomen' carries is_match — proves the
// mapped `bucket` is flag-driven, never the literal 'hired' slug (A1).
export const RENAMED_FUNNEL: LookupItem[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'aangenomen', label: 'Aangenomen', color: '#79B58E', is_match: true },
]
