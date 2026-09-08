import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectMenu from './SelectMenu'
import { FieldRow } from '@/components/forms/fields'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// A modal exactly as the app builds them: useFocusTrap on the panel, which closes
// on Escape. Used to prove an OPEN menu inside one keeps that Escape for itself.
function TrappedModal({ onClose }: { onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div ref={panelRef}>
      <SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />
    </div>
  )
}

// Audit finding (§6, WCAG 2.2 AA): SelectMenu had zero Escape handling and never
// returned focus to the trigger on close — a keyboard user could only close it
// by clicking elsewhere, and then lost their place entirely. Covers Escape,
// focus restoration on pick/Escape, and that a CLOSED menu never swallows an
// Escape meant for an ancestor (e.g. a wrapping modal's own close-on-Escape).
describe('SelectMenu · keyboard + focus (§6 WCAG 2.2 AA)', () => {
  it('Escape closes the open menu', async () => {
    const user = userEvent.setup()
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    expect(screen.getByRole('button', { name: 'b' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'b' })).not.toBeInTheDocument()
  })

  // The other half of that rule, and the one that was broken: while the menu IS open,
  // Escape belongs to the menu and must not reach the modal around it. useFocusTrap
  // listens on the panel node, which sits closer to the key's target than this menu's
  // document-level listener, so the trap consumed the key first and closed the whole
  // modal — throwing away everything the user had filled in (PlanIntakeModal is exactly
  // this shape: a trapped panel with a SelectMenu inside).
  it('keeps Escape for itself while open, so the modal around it stays open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TrappedModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    expect(screen.getByRole('button', { name: 'b' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // The menu closed…
    expect(screen.queryByRole('button', { name: 'b' })).not.toBeInTheDocument()
    // …and the modal did not.
    expect(onClose).not.toHaveBeenCalled()
    // A second Escape, with no menu open, now closes the modal as it should.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('never attaches an Escape listener while closed, so an ancestor still receives the key', async () => {
    const user = userEvent.setup()
    const ancestorSpy = vi.fn()
    document.addEventListener('keydown', ancestorSpy)
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    // Menu is never opened — Escape must reach the document listener untouched.
    await user.keyboard('{Escape}')
    expect(ancestorSpy).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', ancestorSpy)
  })

  it('restores focus to the trigger after picking an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SelectMenu value={null} onChange={onChange} options={['a', 'b']} placeholder="Pick" />)
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'b' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(trigger).toHaveFocus()
  })

  it('restores focus to the trigger after Escape', async () => {
    const user = userEvent.setup()
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

})

// S-icon-1: options may carry an optional `icon` — rendered on the trigger (once
// selected) and in each menu row. Purely additive: a caller that never passes
// icon (every existing call site) sees identical output.
describe('SelectMenu · optional option icon (S-icon-1)', () => {
  it('renders the icon for the selected option on the trigger, and for each option in the menu', async () => {
    const user = userEvent.setup()
    const options = [
      { value: 'a', label: 'Alpha', icon: <span data-testid="icon-a">●</span> },
      { value: 'b', label: 'Beta', icon: <span data-testid="icon-b">●</span> },
    ]
    render(<SelectMenu value="a" onChange={() => {}} options={options} />)
    // Trigger shows the selected option's icon.
    expect(screen.getByTestId('icon-a')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-b')).toBeNull()

    await user.click(screen.getAllByRole('button')[0])
    // Both rows render their own icon once the menu is open.
    expect(screen.getAllByTestId('icon-a').length).toBeGreaterThan(0)
    expect(screen.getByTestId('icon-b')).toBeInTheDocument()
  })

  it('never changes output for callers without icon (backward compatible)', () => {
    render(<SelectMenu value="a" onChange={() => {}} options={['a', 'b']} />)
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('a')
  })
})

// REQUIRED-A11Y-2: SelectMenu forwards `aria-required` onto its trigger so a
// required picker announces to assistive tech (fields.tsx clones it from
// Field/FieldRow onto the child it wraps).
describe('SelectMenu · aria-required forwarding (REQUIRED-A11Y-2)', () => {
  it('sets aria-required="true" on the trigger when aria-required is passed', () => {
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" aria-required />)
    expect(screen.getByRole('button', { name: 'Pick' })).toHaveAttribute('aria-required', 'true')
  })

  it('omits aria-required from the trigger when not passed', () => {
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    expect(screen.getByRole('button', { name: 'Pick' })).not.toHaveAttribute('aria-required')
  })
})

describe('SelectMenu · keyboard + focus (§6 WCAG 2.2 AA), continued', () => {
  it('does not steal focus from another element when closed by an outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />
        <button>elsewhere</button>
      </div>,
    )
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'b' })).toBeInTheDocument()
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()
    expect(trigger).not.toHaveFocus()
  })
})

// ROLE-PICKER-LEFT-1: inside the shared FieldRow (<label id htmlFor> on the trigger)
// the accessible NAME stays the label alone (the name every FieldRow picker test in
// the app queries) and the current value is announced as the accessible
// DESCRIPTION. Folding the value into the name instead renamed ~90 pickers and
// broke 41 name queries (measured 04-09), so this pins both halves.
describe('SelectMenu · FieldRow name + value description (ROLE-PICKER-LEFT-1)', () => {
  it('keeps the label as the name and exposes the picked value as the description', () => {
    render(
      <FieldRow label="Status">
        <SelectMenu value="planner" onChange={() => {}}
          options={[{ value: 'planner', label: 'Planner' }]} />
      </FieldRow>,
    )
    const trigger = screen.getByRole('button', { name: 'Status' })
    expect(trigger).toHaveAccessibleName('Status')
    expect(trigger).toHaveAccessibleDescription('Planner')
  })

  it('describes an empty picker by its placeholder while the name is still the label alone', () => {
    render(
      <FieldRow label="Status">
        <SelectMenu value={null} onChange={() => {}} placeholder="Kies status"
          options={[{ value: 'planner', label: 'Planner' }]} />
      </FieldRow>,
    )
    const trigger = screen.getByRole('button', { name: 'Status' })
    expect(trigger).toHaveAccessibleDescription('Kies status')
  })

  it('adds no description when nothing labels the picker from outside (the name IS its own text)', () => {
    render(<SelectMenu value="planner" onChange={() => {}} options={[{ value: 'planner', label: 'Planner' }]} />)
    expect(screen.getByRole('button', { name: 'Planner' })).not.toHaveAttribute('aria-describedby')
  })
})

// DROPDOWN-CLEAR-1 (Danny 08-09): SelectMenu had no clear at all — 25 pickers were
// permanent once picked. The shared SelectClearButton now renders by default while a
// value is set; clearing emits '' like a pick. Raw i18n keys ('clear') as above.
describe('SelectMenu · clearable (default on, DROPDOWN-CLEAR-1)', () => {
  it('renders the clear control once a value is picked and emits the empty value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SelectMenu value="a" onChange={onChange} options={['a', 'b']} placeholder="Pick" />)
    await user.click(screen.getByRole('button', { name: 'clear' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('renders no clear control while nothing is picked, nor when the caller opted out', () => {
    const { rerender } = render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument()
    // DROPDOWN-CLEAR-1: opt-out shape (in-place editor on a required field).
    rerender(<SelectMenu value="a" onChange={() => {}} options={['a', 'b']} placeholder="Pick" clearable={false} />)
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument()
  })
})

