/**
 * ReportSwitchBar — the top-right population/entity switch every merged report
 * page renders (RAPPORTEN-CONSOLIDATIE-1, Danny's sidebar-shortening ask: "zoals
 * bij SM waar uren of diensten worden"). Placement + treatment mirror the
 * Shiftmanager dashboard's own "In uren / In diensten" toggle
 * (ShiftsChartsBlock: a compact pill row, right-aligned, above the KPI band) —
 * built from the shared `SegmentedControl` (`size="compact"`, `activeOnly`,
 * since the switch means "which population/entity am I looking at", the SAME
 * "on" semantics SM's own toggle uses: only the active pill carries colour, the
 * inactive one stays neutral) instead of a hand-rolled button pair, so every
 * merged report's switch is the ONE shared look (§4).
 *
 * Renders UNCONDITIONALLY (never gated behind loading/error/empty) so a reader
 * can flip populations before data has even arrived — the position is UI state,
 * not a data-dependent affordance.
 */
import SegmentedControl from '@/components/ui/SegmentedControl'
import type { SegmentedControlOption } from '@/components/ui/SegmentedControl'

export default function ReportSwitchBar({ options, value, onChange, ariaLabel }: {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 8px' }}>
      <SegmentedControl options={options} value={value} onChange={onChange} size="compact" activeOnly ariaLabel={ariaLabel} />
    </div>
  )
}
