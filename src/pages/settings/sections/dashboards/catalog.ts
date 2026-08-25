/**
 * dashboards/catalog — pure grouping helpers for the per-role Settings →
 * Dashboards page (F6 rebuild). No API calls, no state — just id→category
 * derivation and search/filter predicates the container and list components
 * share, so the grouping logic has one tested home instead of living inline
 * in JSX.
 */
import { DASHBOARD_TEMPLATES, BLOCK_LABEL_KEY, type DashboardType } from '@/pages/dashboard/shared'

// Block-id categories, derived from the id prefix — 'chart.*' / 'list.*' /
// 'block.*' (Werkfeeds). Anything without a known prefix falls back to 'block'
// so a future id still renders somewhere instead of vanishing silently.
export type BlockCategory = 'chart' | 'list' | 'block'
export const BLOCK_CATEGORY_ORDER: BlockCategory[] = ['block', 'chart', 'list']

// Which category an id belongs to, from its dot-prefix.
export const blockCategory = (id: string): BlockCategory => {
  if (id.startsWith('chart.')) return 'chart'
  if (id.startsWith('list.')) return 'list'
  return 'block'
}

// The block ids a dashboard type shows: '*' (admin/management/…) = every
// known block, else the template's own list — mirrors the pre-rebuild
// DashboardsSettings `blocksFor` so wildcard roles keep showing everything.
export const blocksForRole = (type: DashboardType): string[] => {
  const tpl = DASHBOARD_TEMPLATES[type] ?? []
  return tpl.includes('*') ? Object.keys(BLOCK_LABEL_KEY) : tpl
}

// Group a role's block ids into { block, chart, list } — empty categories are
// omitted so the caller never renders a heading with nothing under it.
export const groupBlocksByCategory = (ids: string[]): Partial<Record<BlockCategory, string[]>> => {
  const groups: Partial<Record<BlockCategory, string[]>> = {}
  ids.forEach(id => {
    const cat = blockCategory(id)
    ;(groups[cat] ??= []).push(id)
  })
  return groups
}

// Search predicate — matches a translated label (or, failing that, the raw
// id) against the query, case-insensitive, trimmed. Empty query matches all.
export const matchesSearch = (label: string, query: string): boolean => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return label.toLowerCase().includes(q)
}

export type OnOffFilter = 'all' | 'on' | 'off'

// Does a row survive the on/off segmented filter?
export const matchesOnOff = (on: boolean, filter: OnOffFilter): boolean =>
  filter === 'all' || (filter === 'on' ? on : !on)
