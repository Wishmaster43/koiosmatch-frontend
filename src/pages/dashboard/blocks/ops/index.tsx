// Ops (backoffice) work-feed tiles — appended by the ops lane. Entries live HERE (index.tsx, JSX allowed, no component exports); never add a sibling index.ts (Vite resolves .ts first and would shadow this file).
import type { FeedTileEntry } from '../feedTileKit'
import { arrayFeed } from '../feedTileKit'
import MatchesByContractTypeDonut from './MatchesByContractTypeDonut'
import PlacementsTodayLists from './PlacementsTodayLists'
import FillRateByBranchBar from './FillRateByBranchBar'
import DocumentsAttentionTable from './DocumentsAttentionTable'
import CouplingErrorsList from './CouplingErrorsList'
import PlacementsStartedTodayTable from './PlacementsStartedTodayTable'

export const OPS_TILES: FeedTileEntry[] = [
  {
    blockId: 'block.matchesByContractType',
    feedKey: 'matches_by_contract_type',
    // Custom predicate: the tile itself drops zero-count rows, so hasData
    // must mirror that or an all-zero feed leaves an empty grid cell.
    hasData: (dash) => (dash.matches_by_contract_type ?? []).some(r => r.count > 0),
    render: (dash, ctx) => <MatchesByContractTypeDonut rows={dash.matches_by_contract_type!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.placementsStartedEndedToday',
    feedKey: 'placements_started_ended_today',
    // Custom predicate: the feed is one object with two arrays, not a single array.
    hasData: (dash) => (dash.placements_started_ended_today?.started.length ?? 0) + (dash.placements_started_ended_today?.ended.length ?? 0) > 0,
    render: (dash, ctx) => <PlacementsTodayLists feed={dash.placements_started_ended_today!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.fillRateByBranch',
    feedKey: 'fill_rate_by_branch',
    // Custom predicate: the tile skips rows with a null rate, so hasData
    // must mirror that or an all-null feed leaves an empty grid cell.
    hasData: (dash) => (dash.fill_rate_by_branch ?? []).some(r => r.rate != null),
    render: (dash, ctx) => <FillRateByBranchBar rows={dash.fill_rate_by_branch!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.documentsAttention',
    feedKey: 'documents_attention',
    span: 2,
    hasData: arrayFeed('documents_attention'),
    render: (dash, ctx) => <DocumentsAttentionTable rows={dash.documents_attention!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.couplingErrorsList',
    feedKey: 'coupling_errors_list',
    hasData: arrayFeed('coupling_errors_list'),
    render: (dash, ctx) => <CouplingErrorsList rows={dash.coupling_errors_list!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.placementsStartedToday',
    feedKey: 'placements_started_today',
    span: 2,
    hasData: arrayFeed('placements_started_today'),
    render: (dash, ctx) => <PlacementsStartedTodayTable rows={dash.placements_started_today!} onNavigate={ctx.onNavigate} />,
  },
]
