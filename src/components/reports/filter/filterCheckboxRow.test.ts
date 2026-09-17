import { describe, it, expect } from 'vitest'
import { checkboxRowHoverHandlers, FILTER_CHECKBOX_INPUT_STYLE } from './filterCheckboxRow'

// Fake the minimal MouseEvent shape checkboxRowHoverHandlers reads/writes.
function fakeEvent() {
  return { currentTarget: { style: { background: '' } } } as unknown as Parameters<
    ReturnType<typeof checkboxRowHoverHandlers>['onMouseEnter']
  >[0]
}

describe('filterCheckboxRow', () => {
  it('exposes the one checkbox input style shared by every filter option row', () => {
    expect(FILTER_CHECKBOX_INPUT_STYLE).toEqual({
      accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0,
    })
  })

  it('tints on hover-enter and clears on hover-leave when the option is unchecked', () => {
    const { onMouseEnter, onMouseLeave } = checkboxRowHoverHandlers(false)
    const e1 = fakeEvent()
    onMouseEnter(e1)
    expect(e1.currentTarget.style.background).toBe('var(--hover-bg)')
    const e2 = fakeEvent()
    e2.currentTarget.style.background = 'var(--hover-bg)'
    onMouseLeave(e2)
    expect(e2.currentTarget.style.background).toBe('transparent')
  })

  it('never overrides the checked-state background on hover', () => {
    const { onMouseEnter, onMouseLeave } = checkboxRowHoverHandlers(true)
    const e = fakeEvent()
    e.currentTarget.style.background = 'var(--color-primary-bg)'
    onMouseEnter(e)
    expect(e.currentTarget.style.background).toBe('var(--color-primary-bg)')
    onMouseLeave(e)
    expect(e.currentTarget.style.background).toBe('var(--color-primary-bg)')
  })
})
