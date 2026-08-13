/**
 * buildVacancyFilterGroups — the right-panel filter config for the vacancies
 * page. Pure function (§0.3 size split): state + options come in, group config
 * goes out — mirrors buildCandidateFilterGroups/buildCustomerFilterGroups.
 * Only REAL server-side filters get a group here (§3 "no fake affordances") —
 * the funnel donut stays navigation-only (jumps to Applications) because
 * VacancyQuery has no funnel-stage filter on the vacancy list itself.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { pickAgentSegment } from './insightPicks'

interface Opt { value?: string | number; label?: string; count?: number; color?: string }

interface BuildArgs {
  t: TFunction
  filters: {
    statusBucket: string; setStatusBucket: Dispatch<SetStateAction<string>>
    publishedBucket: 'all' | 'published' | 'unpublished'; setPublishedBucket: Dispatch<SetStateAction<'all' | 'published' | 'unpublished'>>
    selectedAgentId: string | null; setSelectedAgentId: Dispatch<SetStateAction<string | null>>
    showWithoutAgent: boolean; setShowWithoutAgent: Dispatch<SetStateAction<boolean>>
    hasApplications: boolean; setHasApplications: (fn: (v: boolean) => boolean) => void
    showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
    geoFilter: { q: string; km: number; lat: number; lng: number; label: string } | null; geoHint: string | null
    applyGeo: (q: string, km: number) => void; clearGeo: () => void
  }
  options: { statusOptions: Opt[]; agentOptions: Opt[] }
}

// Pure builder: composes the vacancy filter panel's category groups (status/
// published/AI-agent/has-applications/archived/geo-radius — all real BE params).
export function buildVacancyFilterGroups({ t, filters: f, options: o }: BuildArgs) {
  const catGeneral = t('filters.categories.general')
  const catOrg      = t('filters.categories.organisation')
  const catDisplay  = t('filters.categories.display')

  return [
    { key: 'status', type: 'search-select', category: catGeneral, label: t('filters.status'),
      selected: f.statusBucket === 'all' ? [] : [f.statusBucket], options: o.statusOptions,
      onToggle: (v: string) => f.setStatusBucket(prev => (prev === v ? 'all' : v)) },
    // V27: a real server-side published/unpublished filter (VacancyQuery::filtered()).
    { key: 'published', type: 'checkbox', category: catGeneral, label: t('filters.published'),
      selected: f.publishedBucket === 'all' ? [] : [f.publishedBucket],
      options: [{ value: 'published', label: t('filters.publishedYes') }, { value: 'unpublished', label: t('filters.publishedNo') }],
      onToggle: (v: string) => f.setPublishedBucket(prev => (prev === v ? 'all' : (v === 'published' || v === 'unpublished' ? v : 'all'))) },
    // VAC-AGENT-1/VAC-KPI-REDESIGN: '__none' = the shared "no agent" quick view;
    // any other key = a real agent id. pickAgentSegment keeps the two mutually
    // exclusive — the exact logic the agent donut already uses, reused here.
    { key: 'agent', type: 'search-select', category: catOrg, label: t('insights.agentTitle'),
      selected: f.showWithoutAgent ? ['__none'] : (f.selectedAgentId ? [f.selectedAgentId] : []),
      options: o.agentOptions,
      onToggle: (v: string) => {
        const next = pickAgentSegment({ key: v }, f.selectedAgentId, f.showWithoutAgent)
        f.setSelectedAgentId(next.selectedAgentId); f.setShowWithoutAgent(next.showWithoutAgent)
      } },
    // VAC-HAS-APPLICATIONS-1: a real server-wide whereHas('applications') filter.
    { key: 'hasApplications', type: 'checkbox', category: catGeneral, label: t('kpi.applicationsTotal'),
      selected: f.hasApplications ? ['yes'] : [], options: [{ value: 'yes', label: t('kpi.applicationsTotal') }],
      onToggle: () => f.setHasApplications(v => !v) },
    { key: 'geo', type: 'geo-radius', category: catGeneral, label: t('common:filters.radius'),
      applied: f.geoFilter ? { label: f.geoFilter.label } : null, hint: f.geoHint, km: f.geoFilter?.km ?? 30,
      onApply: f.applyGeo, onClear: f.clearGeo },
    // Archived mirrors the quick-view toggle; both share the showArchived state.
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'),
      selected: f.showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('page.archivedView') }],
      onToggle: () => f.setShowArchived(v => !v) },
  ]
}
