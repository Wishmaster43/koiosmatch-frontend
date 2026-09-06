/**
 * MatchFieldRow — the one read-only field row shape shared by OverviewTab and
 * its split-out sections (MatchClientRow): label LEFT (canon width), value
 * RIGHT (DRILLDOWN-VOLGORDE-CANON, Danny 21-08 "tekst links waarde rechts"),
 * the same EditableFieldTable/FieldRow look every candidate card uses.
 * Extracted into its OWN module rather than exported from OverviewTab.tsx
 * (§0.3 MATCH-CLIENT-EDIT split) — a component file that also exports plain
 * helpers/constants breaks Fast Refresh for every consumer of those exports.
 *
 * K-281 repair (MUST-FIX 2): this file exports the Field COMPONENT ONLY —
 * the shared `dash` empty-value glyph moved to
 * `@/components/drawer/fieldRowCanon` (a non-component module both this file
 * and its consumers already import CANON_LABEL_WIDTH/STYLE from), so no
 * react-refresh/only-export-components disable is needed anywhere here.
 */
import type { ReactNode } from 'react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'

// One read-only field row: label LEFT (canon width), value right.
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}
