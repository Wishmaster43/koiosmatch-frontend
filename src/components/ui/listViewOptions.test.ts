import { describe, it, expect } from 'vitest'
import { tableBoardViewOptions } from './listViewOptions'

// tableBoardViewOptions — the table/board ViewModeToggle option pair shared by
// tasks/opportunities/matches/applications/outreach; MatchesPage is the one
// caller with a different table label key (DRY round 11, BULKBARS).
const t = (key: string) => key

describe('tableBoardViewOptions', () => {
  it('returns the table/board pair with the default table label key', () => {
    const options = tableBoardViewOptions(t)
    expect(options).toEqual([
      { id: 'table', icon: options[0].icon, label: 'view.table' },
      { id: 'board', icon: options[1].icon, label: 'view.board' },
    ])
  })

  it('resolves the table label through a custom key (MatchesPage)', () => {
    const options = tableBoardViewOptions(t, 'view.matches')
    expect(options[0]).toMatchObject({ id: 'table', label: 'view.matches' })
    expect(options[1]).toMatchObject({ id: 'board', label: 'view.board' })
  })
})
