// Planning work-feed tiles — appended by the planning lane. Entries live HERE (index.tsx, JSX allowed, no component exports); never add a sibling index.ts (Vite resolves .ts first and would shadow this file).
import type { FeedTileEntry } from '@/pages/dashboard/blocks/feedTileKit'
import ShiftCoverageHeatmap from './ShiftCoverageHeatmap'
import OpenShiftsList from './OpenShiftsList'
import OccupancyByCustomerBar from './OccupancyByCustomerBar'
import ShiftStatusTodayDonut from './ShiftStatusTodayDonut'
import ShiftsUnconfirmedList from './ShiftsUnconfirmedList'

export const PLANNING_TILES: FeedTileEntry[] = [
  {
    blockId: 'block.shiftCoverageHeatmap',
    feedKey: 'shift_coverage_heatmap',
    span: 2,
    // Custom predicate: the fixed 7x3 grid always has 21 cells, so hasData
    // checks whether any cell actually carries shifts.
    hasData: dash => (dash.shift_coverage_heatmap ?? []).some(c => c.shifts > 0),
    render: (dash, ctx) => <ShiftCoverageHeatmap rows={dash.shift_coverage_heatmap!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.openShiftsList',
    feedKey: 'open_shifts_list',
    hasData: dash => (dash.open_shifts_list ?? []).length > 0,
    render: (dash, ctx) => <OpenShiftsList rows={dash.open_shifts_list!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.occupancyByCustomer',
    feedKey: 'occupancy_by_customer',
    hasData: dash => (dash.occupancy_by_customer ?? []).some(r => r.rate != null),
    render: dash => <OccupancyByCustomerBar rows={dash.occupancy_by_customer!} />,
  },
  {
    blockId: 'block.shiftStatusToday',
    feedKey: 'shift_status_today',
    // Custom predicate: rows may exist with every count at 0.
    hasData: dash => (dash.shift_status_today ?? []).some(r => r.count > 0),
    render: (dash, ctx) => <ShiftStatusTodayDonut rows={dash.shift_status_today!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.shiftsUnconfirmedList',
    feedKey: 'shifts_unconfirmed_list',
    hasData: dash => (dash.shifts_unconfirmed_list ?? []).length > 0,
    render: (dash, ctx) => <ShiftsUnconfirmedList rows={dash.shifts_unconfirmed_list!} onNavigate={ctx.onNavigate} />,
  },
]
