/**
 * reportCompareMode — the compare-window state shared by ReportCompareControl and
 * useReportCompare. Exactly ONE mode is representable at a time (a discriminated
 * union, not two optional fields) so "both compare and compare_from/compare_to at
 * once" is structurally impossible on the client — the 422 the backend guards
 * with is a defence against a malformed direct request, never something the UI
 * itself can produce.
 */
export type ReportCompareMode =
  | { kind: 'off' }
  | { kind: 'previous_period' }
  | { kind: 'previous_year' }
  | { kind: 'custom'; from: string; to: string }

export const COMPARE_OFF: ReportCompareMode = { kind: 'off' }

// Turns a mode into the exact query params the backend contract expects — never
// both `compare` and `compare_from`/`compare_to` in the same object.
export function compareModeToParams(mode: ReportCompareMode): Record<string, string> | null {
  switch (mode.kind) {
    case 'off':
      return null
    case 'previous_period':
      return { compare: 'previous_period' }
    case 'previous_year':
      return { compare: 'previous_year' }
    case 'custom':
      if (!mode.from || !mode.to) return null
      return { compare_from: mode.from, compare_to: mode.to }
  }
}
