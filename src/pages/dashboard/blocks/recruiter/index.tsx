// Recruiter (recruitment) work-feed tiles — appended by the recruiter lane. Entries live HERE (index.tsx, JSX allowed, no component exports); never add a sibling index.ts (Vite resolves .ts first and would shadow this file).
import type { FeedTileEntry } from '../feedTileKit'
import { arrayFeed } from '../feedTileKit'
import TasksDueTodayList from './TasksDueTodayList'
import AppointmentsNext48hList from './AppointmentsNext48hList'
import RedeployRadarList from './RedeployRadarList'
import ProductivityByRecruiterBars from './ProductivityByRecruiterBars'
import FillRateTimeseriesLine from './FillRateTimeseriesLine'

export const RECRUITER_TILES: FeedTileEntry[] = [
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
  {
    blockId: 'block.productivityByRecruiter',
    feedKey: 'productivity_by_recruiter',
    span: 2,
    hasData: arrayFeed('productivity_by_recruiter'),
    render: (dash, ctx) => <ProductivityByRecruiterBars rows={dash.productivity_by_recruiter!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.fillRateTimeseries',
    feedKey: 'fill_rate_timeseries',
    span: 2,
    // Custom predicate: the feed can be a non-empty array of all-null-rate points
    // (no cohort on any day), which renders nothing useful — require ≥1 real rate.
    hasData: (dash) => (dash.fill_rate_timeseries ?? []).some(p => p.rate != null),
    render: (dash) => <FillRateTimeseriesLine rows={dash.fill_rate_timeseries!} />,
  },
]
