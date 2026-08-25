// Sales (sales_manager / accountmanager) work-feed tiles — the registry entries
// live HERE (index.tsx, JSX allowed, no component exports so react-refresh stays
// happy); tile files export only their component. Never add a sibling index.ts:
// Vite resolves .ts before .tsx and would silently shadow this file.
import type { FeedTileEntry } from '../feedTileKit'
import { arrayFeed, pairTiles } from '../feedTileKit'
import { leadsPipelineTile } from '../lists'
import CustomersByOwnerDonut from './CustomersByOwnerDonut'
import OppsByStageByOwnerStacked from './OppsByStageByOwnerStacked'
import OppsStalledTable from './OppsStalledTable'
import ActivityByOwnerList from './ActivityByOwnerList'
import PipelineValueLine from './PipelineValueLine'
import CustomersAtRiskList from './CustomersAtRiskList'

export const SALES_TILES: FeedTileEntry[] = [
  {
    blockId: 'block.customersByOwner',
    feedKey: 'customers_by_owner',
    hasData: arrayFeed('customers_by_owner'),
    render: (dash, ctx) => <CustomersByOwnerDonut dash={dash} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.oppsByStageByOwner',
    feedKey: 'opps_by_stage_by_owner',
    hasData: arrayFeed('opps_by_stage_by_owner'),
    render: (dash, ctx) => <OppsByStageByOwnerStacked rows={dash.opps_by_stage_by_owner!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.oppsStalledList',
    feedKey: 'opps_stalled_list',
    span: 2,
    hasData: arrayFeed('opps_stalled_list'),
    render: (dash, ctx) => <OppsStalledTable rows={dash.opps_stalled_list!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.activityByOwner',
    feedKey: 'activity_by_owner',
    hasData: arrayFeed('activity_by_owner'),
    render: (dash, ctx) => <ActivityByOwnerList rows={dash.activity_by_owner!} onNavigate={ctx.onNavigate} />,
  },
  // DASH-PAIRS-1 (Danny 25-08): pipeline value and the leads pipeline side by side.
  pairTiles('pair.pipelineValueLeads', [
    {
      blockId: 'block.pipelineValueTimeseries',
      feedKey: 'pipeline_value_timeseries',
      hasData: arrayFeed('pipeline_value_timeseries'),
      render: (dash, ctx) => <PipelineValueLine rows={dash.pipeline_value_timeseries!} onNavigate={ctx.onNavigate} />,
    },
    leadsPipelineTile,
  ]),
  {
    blockId: 'block.customersAtRiskList',
    feedKey: 'customers_at_risk_list',
    hasData: arrayFeed('customers_at_risk_list'),
    render: (dash, ctx) => <CustomersAtRiskList rows={dash.customers_at_risk_list!} onNavigate={ctx.onNavigate} />,
  },
]
