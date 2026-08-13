/**
 * buildTaskFilterGroups — seam test for the new deadline-range/team/linked-
 * entity/archived groups (parity sweep, half 2). Asserts the archived group's
 * onToggle flips the SAME showArchived flag useTasksData sends as its fetch
 * param (?archived=1), and the date-range group wires the real setters, not
 * only that a callback fired.
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildTaskFilterGroups } from './taskFilterGroups'

const tog = (set: (fn: (p: string[]) => string[]) => void) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

function build(overrides: Partial<Parameters<typeof buildTaskFilterGroups>[0]> = {}) {
  const setShowArchived = vi.fn()
  const setDueRange = vi.fn()
  const args = {
    t: i18n.getFixedT('nl', 'tasks'),
    tog,
    selectedStatus: [], setSelectedStatus: vi.fn(),
    selectedPriority: [], setSelectedPriority: vi.fn(),
    selectedType: [], setSelectedType: vi.fn(),
    selectedAssignee: [], setSelectedAssignee: vi.fn(),
    selectedTeam: [], setSelectedTeam: vi.fn(),
    selectedLinkType: [], setSelectedLinkType: vi.fn(),
    dueRange: null, setDueRange,
    showArchived: false, setShowArchived,
    statusData: [], priorityData: [], typeData: [],
    assigneeOptions: [], teamOptions: [{ value: 'Backoffice', label: 'Backoffice', count: 2 }],
    linkTypeOptions: [{ value: 'candidate', count: 3 }],
    ...overrides,
  } as Parameters<typeof buildTaskFilterGroups>[0]
  return { groups: buildTaskFilterGroups(args), setShowArchived, setDueRange }
}

describe('buildTaskFilterGroups · parity groups (half 2)', () => {
  it('emits an archived checkbox group whose onToggle flips the request-driving flag', () => {
    const { groups, setShowArchived } = build()
    const archived = groups.find(g => g.key === 'archived') as { onToggle: (v: string) => void }
    archived.onToggle('archived')
    expect(setShowArchived).toHaveBeenCalledTimes(1)
    // The setter is the functional updater useTasksData reads to build ?archived=1.
    const updater = setShowArchived.mock.calls[0][0] as (v: boolean) => boolean
    expect(updater(false)).toBe(true)
  })

  it('emits a date-range group that calls setDueRange with the real from/to on change', () => {
    const { groups, setDueRange } = build()
    const range = groups.find(g => g.key === 'dueRange') as { onFromChange: (v: string) => void; onToChange: (v: string) => void }
    range.onFromChange('2026-01-01')
    expect(setDueRange).toHaveBeenCalledWith({ from: '2026-01-01', to: '' })
    range.onToChange('2026-01-31')
    expect(setDueRange).toHaveBeenCalledWith({ from: '', to: '2026-01-31' })
  })

  it('emits a team group only when options exist, categorised under Organisation', () => {
    const { groups } = build()
    const team = groups.find(g => g.key === 'team') as { category: string; options: unknown[] }
    expect(team).toBeTruthy()
    expect(team.options).toHaveLength(1)
  })

  it('omits the team group entirely when there is no data (no empty group)', () => {
    const { groups } = build({ teamOptions: [] } as unknown as Parameters<typeof buildTaskFilterGroups>[0])
    expect(groups.find(g => g.key === 'team')).toBeUndefined()
  })

  it('labels the linked-entity options via the shared links.* i18n keys', () => {
    const { groups } = build()
    const linkType = groups.find(g => g.key === 'linkType') as { options: { value: string; label: string }[] }
    expect(linkType.options[0]).toEqual({ value: 'candidate', label: i18n.getFixedT('nl', 'tasks')('links.candidate'), count: 3 })
  })
})
