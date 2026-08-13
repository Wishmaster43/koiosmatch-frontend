/**
 * buildOpportunityFilterGroups — seam test for the lifecycle/organisation
 * category headers + the new archived group (parity sweep, half 2). Asserts
 * the archived group's onToggle flips the SAME showArchived flag
 * useOpportunitiesData sends as its fetch param, and every group carries the
 * right category so the panel renders the two headers, not a flat list.
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildOpportunityFilterGroups } from './opportunityFilterGroups'

const tog = (set: (fn: (p: string[]) => string[]) => void) => (v: string) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])

function build() {
  const setShowArchived = vi.fn()
  const t = i18n.getFixedT('nl', 'opportunities')
  const optionsFrom = () => [{ value: 'a', label: 'a' }]
  const groups = buildOpportunityFilterGroups({
    t, tog,
    stage: [], setStage: vi.fn(),
    owner: [], setOwner: vi.fn(),
    client: [], setClient: vi.fn(),
    selectedBranch: [], setSelectedBranch: vi.fn(),
    showArchived: false, setShowArchived,
    optionsFrom,
    branchOptions: [{ value: 'b', label: 'b' }],
  })
  return { groups, setShowArchived }
}

describe('buildOpportunityFilterGroups · category headers + archived (parity, half 2)', () => {
  it('emits an archived checkbox group whose onToggle flips the request-driving flag', () => {
    const { groups, setShowArchived } = build()
    const archived = groups.find(g => g.key === 'archived') as unknown as { onToggle: () => void }
    archived.onToggle()
    const updater = setShowArchived.mock.calls[0][0] as (v: boolean) => boolean
    expect(updater(false)).toBe(true)
  })

  it('splits stage into "lifecycle" and owner/client/branch into "organisation"', () => {
    const { groups } = build()
    const t = i18n.getFixedT('nl', 'opportunities')
    const stage  = groups.find(g => g.key === 'stage')
    const owner  = groups.find(g => g.key === 'owner')
    const branch = groups.find(g => g.key === 'branch')
    expect(stage?.category).toBe(t('filters.categories.lifecycle'))
    expect(owner?.category).toBe(t('filters.categories.organisation'))
    expect(branch?.category).toBe(t('filters.categories.organisation'))
  })

  it('categorises the archived group under Display, distinct from lifecycle/organisation', () => {
    const { groups } = build()
    const t = i18n.getFixedT('nl', 'opportunities')
    const archived = groups.find(g => g.key === 'archived')
    expect(archived?.category).toBe(t('filters.categories.display'))
  })
})
