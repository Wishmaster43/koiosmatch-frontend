import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { menuShellStyle } from './useDropdownPlacement'

// menuShellStyle's key ORDER matters: React's server renderer writes the
// `style` HTML attribute in the object's own insertion order, and
// MODULE-FACE-BEVRIES requires byte-identical markup on every touched surface
// (DRY round 11, LAYOUT). These assertions pin each caller's exact pre-refactor
// order (measured on CreatableSelect.tsx / SelectMenu.tsx before this change),
// via react-dom/server so a real render — not just object identity — proves it.
const rect = { top: 100, bottom: 130, left: 40, right: 240, width: 200 }

describe('menuShellStyle', () => {
  it('places maxHeight right after minWidth for CreatableSelect (maxHeightAtEnd default false)', () => {
    const style = menuShellStyle(rect, false, 200, 240)
    expect(Object.keys(style)).toEqual([
      'position', 'zIndex', 'minWidth', 'maxHeight', 'visibility', 'left', 'top',
      'background', 'border', 'borderRadius', 'boxShadow', 'overflow',
    ])
  })

  it('places maxHeight after overflow for SelectMenu (maxHeightAtEnd true), overflowY layered on by the caller', () => {
    const style = { ...menuShellStyle(rect, false, 170, 240, true), overflowY: 'auto' as const }
    expect(Object.keys(style)).toEqual([
      'position', 'zIndex', 'minWidth', 'visibility', 'left', 'top',
      'background', 'border', 'borderRadius', 'boxShadow', 'overflow', 'maxHeight', 'overflowY',
    ])
  })

  it('flips to `bottom` (not `top`) when openUp is true, same position in the key order', () => {
    const style = menuShellStyle(rect, true, 200, 240)
    expect(Object.keys(style)).toEqual([
      'position', 'zIndex', 'minWidth', 'maxHeight', 'visibility', 'left', 'bottom',
      'background', 'border', 'borderRadius', 'boxShadow', 'overflow',
    ])
  })

  it('renders a real style attribute in that same property order (CreatableSelect shape)', () => {
    const html = renderToStaticMarkup(<div style={menuShellStyle(rect, false, 200, 240)} />)
    const styleAttr = html.match(/style="([^"]*)"/)?.[1] ?? ''
    const propOrder = styleAttr.split(';').filter(Boolean).map(pair => pair.split(':')[0])
    expect(propOrder).toEqual([
      'position', 'z-index', 'min-width', 'max-height', 'visibility', 'left', 'top',
      'background', 'border', 'border-radius', 'box-shadow', 'overflow',
    ])
  })

  it('renders a real style attribute in that same property order (SelectMenu shape)', () => {
    const html = renderToStaticMarkup(
      <div style={{ ...menuShellStyle(rect, false, 170, 240, true), overflowY: 'auto' }} />,
    )
    const styleAttr = html.match(/style="([^"]*)"/)?.[1] ?? ''
    const propOrder = styleAttr.split(';').filter(Boolean).map(pair => pair.split(':')[0])
    expect(propOrder).toEqual([
      'position', 'z-index', 'min-width', 'visibility', 'left', 'top',
      'background', 'border', 'border-radius', 'box-shadow', 'overflow', 'max-height', 'overflow-y',
    ])
  })

  it('hides the menu (visibility) and skips the flip offset until the anchor rect is measured', () => {
    const style = menuShellStyle(null, false, 200, 240)
    expect(style.visibility).toBe('hidden')
    expect(style.left).toBe(0)
    expect(style.top).toBeUndefined()
    expect(style.bottom).toBeUndefined()
  })
})
