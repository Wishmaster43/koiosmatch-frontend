// Recent lists + KD11 widget feeds as registry entries (DASH-PAIRS-1). Entries
// live HERE (index.tsx, JSX allowed, no component exports); never add a sibling
// index.ts (Vite resolves .ts first and would shadow this file). Rows come from
// the viewmodel via ctx.lists, so the tenant-lookup mapping stays in one place.
import type { FeedTileEntry, FeedTileLists } from '../feedTileKit'
import { WidgetFeedList, RecentCandidatesList, RecentApplicationsList, LeadsPipelineList, RecentRunsList, RecentConversationsList } from './RecentLists'

// A list tile has data when its viewmodel rows are non-empty.
const listRows = <K extends keyof FeedTileLists>(key: K) => (_dash: unknown, ctx?: { lists?: FeedTileLists }) =>
  (ctx?.lists?.[key]?.length ?? 0) > 0

export const expiringMatchesTile: FeedTileEntry = {
  blockId: 'block.expiringMatches', feedKey: 'expiring_matches', hasData: listRows('expiringMatchesRows'),
  render: (_d, ctx) => <WidgetFeedList titleKey="block.expiringMatches" rows={ctx.lists?.expiringMatchesRows ?? []} />,
}
export const staleVacanciesTile: FeedTileEntry = {
  blockId: 'block.staleVacancies', feedKey: 'stale_vacancies', hasData: listRows('staleVacanciesRows'),
  render: (_d, ctx) => <WidgetFeedList titleKey="block.staleVacancies" rows={ctx.lists?.staleVacanciesRows ?? []} />,
}
export const koiosSuggestionsTile: FeedTileEntry = {
  blockId: 'block.koiosSuggestions', feedKey: 'koios_suggestions', hasData: listRows('koiosSuggestionsRows'),
  render: (_d, ctx) => <WidgetFeedList titleKey="block.koiosSuggestions" rows={ctx.lists?.koiosSuggestionsRows ?? []} />,
}
export const recentCandidatesTile: FeedTileEntry = {
  blockId: 'list.candidates', feedKey: 'recent', hasData: listRows('recentCandidates'),
  render: (_d, ctx) => <RecentCandidatesList rows={ctx.lists?.recentCandidates ?? []} onNavigate={ctx.onNavigate} />,
}
export const recentApplicationsTile: FeedTileEntry = {
  blockId: 'list.applications', feedKey: 'recent', hasData: listRows('recentApplications'),
  render: (_d, ctx) => <RecentApplicationsList rows={ctx.lists?.recentApplications ?? []} onNavigate={ctx.onNavigate} />,
}
export const leadsPipelineTile: FeedTileEntry = {
  blockId: 'list.leads', feedKey: 'recent', hasData: listRows('recentLeads'),
  render: (_d, ctx) => <LeadsPipelineList rows={ctx.lists?.recentLeads ?? []} onNavigate={ctx.onNavigate} />,
}
export const recentRunsTile: FeedTileEntry = {
  blockId: 'list.runs', feedKey: 'ai_runs', hasData: listRows('runs'),
  render: (_d, ctx) => <RecentRunsList rows={ctx.lists?.runs ?? []} onNavigate={ctx.onNavigate} />,
}
export const recentConversationsTile: FeedTileEntry = {
  blockId: 'list.conversations', feedKey: 'conversations', hasData: listRows('conversations'),
  render: (_d, ctx) => <RecentConversationsList rows={ctx.lists?.conversations ?? []} onNavigate={ctx.onNavigate} />,
}

// Render order of the bottom grid: the three KD11 widgets, then the recent
// lists. A list a pair already pulled into the top grid is excluded there.
export const LIST_TILES: FeedTileEntry[] = [
  expiringMatchesTile, staleVacanciesTile, koiosSuggestionsTile,
  recentCandidatesTile, recentApplicationsTile, leadsPipelineTile, recentRunsTile, recentConversationsTile,
]
