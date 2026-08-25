// Account-manager work-feed tiles — appended by the accountmanager lane. Entries live HERE (index.tsx, JSX allowed, no component exports); never add a sibling index.ts (Vite resolves .ts first and would shadow this file).
import type { FeedTileEntry } from '../feedTileKit'
import { arrayFeed } from '../feedTileKit'
import VacanciesAttentionTable from './VacanciesAttentionTable'
import VacanciesByCustomerStacked from './VacanciesByCustomerStacked'
import CustomersByPhaseDonut from './CustomersByPhaseDonut'

export const ACCOUNTMANAGER_TILES: FeedTileEntry[] = [
  {
    blockId: 'block.vacanciesAttentionByCustomer',
    feedKey: 'vacancies_attention_by_customer',
    span: 2,
    hasData: arrayFeed('vacancies_attention_by_customer'),
    render: (dash, ctx) => <VacanciesAttentionTable rows={dash.vacancies_attention_by_customer!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.vacanciesByCustomer',
    feedKey: 'vacancies_by_customer',
    hasData: arrayFeed('vacancies_by_customer'),
    render: (dash, ctx) => <VacanciesByCustomerStacked rows={dash.vacancies_by_customer!} onNavigate={ctx.onNavigate} />,
  },
  {
    blockId: 'block.customersByPhase',
    feedKey: 'customers_by_phase',
    // Custom predicate: the feed is a fixed set of phases (may all be present with
    // zero counts), so "has data" means at least one non-zero count, not "array present".
    hasData: dash => (dash.customers_by_phase ?? []).some(r => r.count > 0),
    render: (dash, ctx) => <CustomersByPhaseDonut rows={dash.customers_by_phase!} onNavigate={ctx.onNavigate} />,
  },
]
