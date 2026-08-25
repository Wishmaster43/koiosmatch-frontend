/**
 * buildCustomerFilterGroups — regression guard for the DATUM-1 zero-pad fix
 * (fix-round audit): the period-chip label must render a single-digit
 * day/month as DD-MM-YYYY, never the un-padded "5-8-2026" a raw
 * toLocaleDateString('nl-NL') without options used to produce.
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildCustomerFilterGroups } from './customerFilterGroups'
import type { CustomerDateRange } from './customerFilterGroups'

const tog = (set: (fn: (p: string[]) => string[]) => void) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

// All filter/option fields wired with harmless empty defaults — only
// `dateRange` varies per test, since that is what drives the period chip.
function build(dateRange: CustomerDateRange | null) {
  const t = i18n.getFixedT('nl', 'customers')
  return buildCustomerFilterGroups({
    t, tog,
    filters: {
      selectedStatus: [], setSelectedStatus: vi.fn(),
      selectedPhase: [], setSelectedPhase: vi.fn(),
      selectedIndustry: [], setSelectedIndustry: vi.fn(),
      selectedCity: [], setSelectedCity: vi.fn(),
      selectedProvince: [], setSelectedProvince: vi.fn(),
      selectedOwner: [], setSelectedOwner: vi.fn(),
      selectedBranch: [], setSelectedBranch: vi.fn(),
      showArchived: false, setShowArchived: vi.fn(),
      dateRange, setDateRange: vi.fn(),
      geoFilter: null, geoHint: null, applyGeo: vi.fn(), clearGeo: vi.fn(),
    },
    options: {
      statusOptions: [], phaseOptions: [], industryOptions: [],
      cityOptions: [], provinceOptions: [], ownerOptions: [], branchOptions: [],
    },
  })
}

describe('buildCustomerFilterGroups · period chip zero-pads single-digit day/month (DATUM-1)', () => {
  it('renders a single-digit day/month as zero-padded DD-MM-YYYY', () => {
    const groups = build({ param: 'created_between', from: '2026-08-05T00:00:00', to: '2026-08-09T00:00:00' })
    const period = groups.find(g => g.key === 'period') as { options: { label: string }[] }
    expect(period.options[0].label).toBe('05-08-2026 – 09-08-2026')
    expect(period.options[0].label).not.toContain('5-8-2026')
  })

  it('omits the period group entirely when no date range is active', () => {
    const groups = build(null)
    expect(groups.find(g => g.key === 'period')).toBeUndefined()
  })
})
