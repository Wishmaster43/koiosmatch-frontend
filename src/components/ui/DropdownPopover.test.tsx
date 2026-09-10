/**
 * Test for DropdownPopover: the caller gates mounting on `open` (the same
 * `{open && …}` short-circuit every picker used with createPortal directly —
 * PERF r11 v2: this component itself never renders its children while closed
 * unless MOUNTED). While mounted, it portals its content into document.body
 * carrying the given id/style and the DROPDOWN_PORTAL_ATTR marker — the
 * boilerplate CreatableSelect, SelectMenu and SearchSelect used to each
 * repeat inline.
 */
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import DropdownPopover from './DropdownPopover'
import { DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'

// Harness mirrors how every consumer holds its own menuRef and gates mounting
// on `open` at the call site (`{open && <DropdownPopover>…</DropdownPopover>}`).
function Harness({ open }: { open: boolean }) {
  const menuRef = useRef<HTMLDivElement>(null)
  return (
    <>
      {open && (
        <DropdownPopover menuRef={menuRef} id="my-menu" style={{ minWidth: 100 }}>
          <span>content</span>
        </DropdownPopover>
      )}
    </>
  )
}

describe('DropdownPopover', () => {
  test('renders nothing while the caller keeps it unmounted (closed)', () => {
    render(<Harness open={false} />)
    expect(document.getElementById('my-menu')).toBeNull()
  })

  test('portals its content into document.body with the id, style and portal marker once mounted', () => {
    render(<Harness open={true} />)
    const menu = document.getElementById('my-menu')
    expect(menu).not.toBeNull()
    expect(menu?.parentElement).toBe(document.body)
    expect(menu?.hasAttribute(DROPDOWN_PORTAL_ATTR)).toBe(true)
    expect(menu?.style.minWidth).toBe('100px')
    expect(menu?.textContent).toBe('content')
  })
})
