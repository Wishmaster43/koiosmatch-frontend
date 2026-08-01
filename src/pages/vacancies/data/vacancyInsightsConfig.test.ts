import { describe, it, expect, vi } from 'vitest'
import { buildVacancyInsightsConfig } from './vacancyInsightsConfig'
import type { TFunction } from 'i18next'

// i18n is not initialised here → t() returns the key, so we assert on keys.
const t = ((k: string) => k) as unknown as TFunction

// Minimal arg set; only the applications-KPI wiring matters for these tests.
const build = (over: Record<string, unknown> = {}) => buildVacancyInsightsConfig({
  t, navigate: vi.fn(),
  statusData: [], ownerData: [], clientData: [], categoryData: [], publishedData: [], funnelData: [],
  agentData: [{ name: 'Geen agent', key: '__none', value: 4 }],
  statusBucket: 'all', setStatusBucket: vi.fn(),
  selectedOwner: [], pickOwner: vi.fn(), clearOwner: vi.fn(),
  selectedClient: [], pickClient: vi.fn(), clearClient: vi.fn(),
  selectedCategory: [], pickCategory: vi.fn(), clearCategory: vi.fn(),
  publishedBucket: 'all', setPublishedBucket: vi.fn(),
  selectedAgentId: null, setSelectedAgentId: vi.fn(), showWithoutAgent: false, setShowWithoutAgent: vi.fn(),
  toggleWithoutAgent: vi.fn(),
  applicationsTotal: 42, hasApplications: false, setHasApplications: vi.fn(),
  ...over,
} as Parameters<typeof buildVacancyInsightsConfig>[0])

const applicationsKpi = (cfg: ReturnType<typeof build>) => cfg.kpis.find(k => k.key === 'applicationsTotal')!

describe('buildVacancyInsightsConfig · applications KPI (VAC-HAS-APPLICATIONS-1)', () => {
  it('is click-to-filter, like every other card on the row', () => {
    expect(typeof applicationsKpi(build()).onClick).toBe('function')
  })

  it('toggles the has_applications filter on and back off', () => {
    const setHasApplications = vi.fn()
    applicationsKpi(build({ setHasApplications })).onClick!()
    // The card owns no state — it hands the setter a flip function.
    const flip = setHasApplications.mock.calls[0][0] as (v: boolean) => boolean
    expect(flip(false)).toBe(true)
    expect(flip(true)).toBe(false)
  })

  it('reflects the active filter so the card reads as switched on', () => {
    expect(applicationsKpi(build()).active).toBe(false)
    expect(applicationsKpi(build({ hasApplications: true })).active).toBe(true)
  })

  it('carries the hint that the click filters VACANCIES while the number counts applications', () => {
    const kpi = applicationsKpi(build())
    expect(kpi.value).toBe(42)
    expect(kpi.sub).toBe('kpi.applicationsTotalHint')
  })
})
