/**
 * Drill-click handlers shared by the report charts. A donut slice or bar hands its
 * datum to the report, which looks the segment up by key and opens the shared drill
 * drawer with the XOR param for that axis. Every report copied that lookup; it lives
 * here once (DRY-1 O5 round 8). The handlers accept `unknown` so they plug into both
 * PieChartCard's onItemClick and BarChartCard's onBarClick unchanged.
 */

export interface KeyedSegment { value: string; label: string; count: number }
export interface OwnerSegment { owner_id: string; name: string; count: number }

// Recharts hands the datum itself or wraps it in `payload`; both carry the key.
const keyOf = (d: unknown): string | undefined =>
  (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key

// Axis segment click: find the segment by its value and drill on `{ [axis]: value }`.
export function segmentClick<T extends KeyedSegment>(
  segs: T[], axis: string, open: (seg: T, params: Record<string, unknown>) => void,
) {
  return (d: unknown) => {
    const key = keyOf(d)
    const seg = segs.find(s => s.value === key)
    if (seg) open(seg, { [axis]: seg.value })
  }
}

// Owner/assignee bar click (D2 shape: owner_id/name): the drill's segment shows the
// owner's name as its label and filters on the id.
export function ownerClick(
  segs: OwnerSegment[], open: (seg: { label: string; count: number }, params: Record<string, unknown>) => void,
  param: string = 'owner',
) {
  return (d: unknown) => {
    const key = keyOf(d)
    const seg = segs.find(s => s.owner_id === key)
    if (seg) open({ label: seg.name, count: seg.count }, { [param]: seg.owner_id })
  }
}
