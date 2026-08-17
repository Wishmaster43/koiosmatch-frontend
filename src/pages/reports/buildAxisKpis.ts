/**
 * buildAxisKpis — derives extra, HONEST KPI cards straight from a report's own
 * axis segments (CandidatesReport/ApplicationsReport/CustomersReport each carry
 * five-ish axis arrays but shipped only one "total" card). Round-robins each
 * axis's own top segments (axis #1 first, then axis #2, …) until `slots` cards
 * are filled or every axis runs out — so a thin axis (one tenant value) simply
 * yields its turn instead of starving the strip or forcing a fake number.
 * Every value/label here is a real count already returned by the endpoint;
 * nothing is invented, no zero is shown to mean "unknown" (CLAUDE.md §0 no fake
 * affordances). Shared by the three reports so this derivation lives in ONE
 * place, not copy-pasted three times (§11 — a helper lands with adoption).
 *
 * REPORTS-KPI-SPARE-2: a config MAY carry exactly one segment with an empty
 * `label` — a single-segment "signal" pseudo-axis (CustomersReport's `kpis[]`
 * spares, see kpiCatalog.ts) whose axisLabel already fully names the card, so
 * appending "": " + ''" would print a bare trailing colon. Only that case skips
 * the segment label; every real multi-segment axis still reads "Axis: Segment".
 */
import type { KpiSpec } from '@/components/insights/InsightsRow'

// One axis's segments, already normalised to a flat {key,label,count} shape by
// the caller (CandidateSegment vs CandidateOwnerSegment carry different field
// names — normalising here keeps this helper's own type simple and shared).
export interface AxisKpiSeg { key: string; label: string; count: number }
export interface AxisKpiConfig { axis: string; axisLabel: string; segs: AxisKpiSeg[] }

export function buildAxisKpis(
  configs: AxisKpiConfig[],
  slots: number,
  onPick: (axis: string, key: string) => void,
  isActive: (axis: string, key: string) => boolean,
): KpiSpec[] {
  // Sort each axis's own segments desc by count so "round 0" always picks the
  // axis's real top value, "round 1" its real runner-up, and so on.
  const sorted = configs.map(c => ({ ...c, sortedSegs: [...c.segs].sort((a, b) => b.count - a.count) }))
  const picks: KpiSpec[] = []
  for (let round = 0; picks.length < slots; round++) {
    let addedThisRound = false
    for (const c of sorted) {
      if (picks.length >= slots) break
      const seg = c.sortedSegs[round]
      if (!seg) continue
      addedThisRound = true
      picks.push({
        key: `${c.axis}:${seg.key}`,
        label: seg.label ? `${c.axisLabel}: ${seg.label}` : c.axisLabel,
        value: seg.count,
        active: isActive(c.axis, seg.key),
        onClick: () => onPick(c.axis, seg.key),
      })
    }
    // Every axis exhausted before reaching `slots` — stop, never pad with fakes.
    if (!addedThisRound) break
  }
  return picks
}
