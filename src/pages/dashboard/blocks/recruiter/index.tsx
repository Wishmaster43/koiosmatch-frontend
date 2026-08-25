// Recruiter (recruitment + recruitment_manager) work-feed tiles. Entries live HERE
// (index.tsx, JSX allowed, no component exports); never add a sibling index.ts
// (Vite resolves .ts first and would shadow this file).
import type { FeedTileEntry } from '../feedTileKit'
import { arrayFeed, pairTiles } from '../feedTileKit'
import RecruiterLoad from '../RecruiterLoad'
import TasksDueTodayList from './TasksDueTodayList'
import AppointmentsNext48hList from './AppointmentsNext48hList'
import RedeployRadarList from './RedeployRadarList'
import ProductivityByRecruiterBars from './ProductivityByRecruiterBars'
import FillRateTimeseriesLine from './FillRateTimeseriesLine'

// K-173 fase 6 — the recruitment_manager team-load block, now a registry tile.
export const recruiterLoadTile: FeedTileEntry = {
  blockId: 'block.recruiterLoad',
  feedKey: 'recruiter_load',
  hasData: arrayFeed('recruiter_load'),
  render: (dash, ctx) => <RecruiterLoad rows={dash.recruiter_load!} onNavigate={ctx.onNavigate} />,
}

export const fillRateTimeseriesTile: FeedTileEntry = {
  blockId: 'block.fillRateTimeseries',
  feedKey: 'fill_rate_timeseries',
  // Custom predicate: the feed can be a non-empty array of all-null-rate points
  // (no cohort on any day), which renders nothing useful — require ≥1 real rate.
  hasData: (dash) => (dash.fill_rate_timeseries ?? []).some(p => p.rate != null),
  render: (dash) => <FillRateTimeseriesLine rows={dash.fill_rate_timeseries!} />,
}

export const RECRUITER_TILES: FeedTileEntry[] = [
  // DASH-PAIRS-1 (Danny 25-08): team load and the 14-day fill rate side by side.
  pairTiles('pair.recruiterLoadFillRate', [recruiterLoadTile, fillRateTimeseriesTile]),
  {
    blockId: 'block.productivityByRecruiter',
    feedKey: 'productivity_by_recruiter',
    span: 2,
    hasData: arrayFeed('productivity_by_recruiter'),
    render: (dash, ctx) => <ProductivityByRecruiterBars rows={dash.productivity_by_recruiter!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.tasksDueToday',
    feedKey: 'tasks_due_today',
    hasData: arrayFeed('tasks_due_today'),
    render: (dash, ctx) => <TasksDueTodayList rows={dash.tasks_due_today!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.appointmentsNext48h',
    feedKey: 'appointments_next_48h',
    hasData: arrayFeed('appointments_next_48h'),
    render: (dash, ctx) => <AppointmentsNext48hList rows={dash.appointments_next_48h!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.redeployRadar',
    feedKey: 'redeploy_radar',
    hasData: arrayFeed('redeploy_radar'),
    render: (dash, ctx) => <RedeployRadarList rows={dash.redeploy_radar!} onNavigate={ctx.onNavigate} />,
  },
]
