import type { CSSProperties } from 'react'

// Canonical toolbar-row spacing spec (CLAUDE.md §4, "the toolbar row under the
// InsightsRow uses the one spacing spec"): padding '0 24px 12px', minHeight 36,
// gap 10, alignItems center, no background/divider. Spread this first at every
// toolbar row so the KPI-row→button gap stays identical across pages; add
// page-specific properties (flexShrink, flexWrap, justifyContent, …) AFTER
// the spread — never change these five values per screen.
export const TOOLBAR_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 24px 12px',
  minHeight: 36,
}
