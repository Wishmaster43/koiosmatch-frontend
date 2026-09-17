/**
 * buildTaskInsights — KPI-RIJ-9-1: the strip now carries 4 donuts + 5 KPI
 * cards (9 total, §3A blueprint footprint). Covers the new "assignee" donut
 * and the new "unassigned" KPI card (value + click-to-filter toggle).
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import { buildTaskInsights } from './taskInsights'
import i18n from '@/i18n'

const t = i18n.getFixedT('nl', 'tasks')

function build(overrides: Partial<Parameters<typeof buildTaskInsights>[0]> = {}) {
  return buildTaskInsights({
    t, statusData: [], priorityData: [], typeData: [], assigneeData: [{ name: 'Nora', key: 'Nora', value: 2 }],
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedPriority: [], setSelectedPriority: vi.fn(),
    selectedType: [], setSelectedType: vi.fn(),
    selectedAssignee: [], setSelectedAssignee: vi.fn(),
    kpiFilter: null, toggleKpi: vi.fn(),
    openCount: 1, overdue: 2, dueToday: 3, completedCount: 4, unassigned: 5,
    ...overrides,
  })
}

describe('buildTaskInsights · KPI-RIJ-9-1 footprint', () => {
  it('renders 4 donuts + 5 KPI cards (9 total)', () => {
    const { donuts, kpis } = build()
    expect(donuts).toHaveLength(4)
    expect(kpis).toHaveLength(5)
    expect(donuts.map(d => d.key)).toEqual(['status', 'priority', 'type', 'assignee'])
  })

  it('the assignee donut carries assigneeData and is active once a value is selected', () => {
    const { donuts } = build({ selectedAssignee: ['Nora'] })
    const assigneeDonut = donuts.find(d => d.key === 'assignee')!
    expect(assigneeDonut.data).toEqual([{ name: 'Nora', key: 'Nora', value: 2 }])
    expect(assigneeDonut.active).toBe(true)
  })

  it('the unassigned KPI card shows the count and toggles kpiFilter', () => {
    const toggleKpi = vi.fn()
    const { kpis } = build({ toggleKpi, kpiFilter: 'unassigned' })
    const card = kpis.find(k => k.key === 'unassigned')!
    expect(card.value).toBe(5)
    expect(card.active).toBe(true)
    card.onClick?.()
    expect(toggleKpi).toHaveBeenCalledWith('unassigned')
  })
})
