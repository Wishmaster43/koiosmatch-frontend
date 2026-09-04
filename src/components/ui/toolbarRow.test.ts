import { describe, expect, it } from 'vitest'
import { TOOLBAR_ROW_STYLE } from './toolbarRow'

// Pins the canonical toolbar-row spec (CLAUDE.md §4) so a future edit cannot
// silently drift the shared values away from the ten toolbar call sites.
describe('TOOLBAR_ROW_STYLE', () => {
  it('matches the exact §4 spacing spec', () => {
    expect(TOOLBAR_ROW_STYLE).toEqual({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 24px 12px',
      minHeight: 36,
    })
  })
})
