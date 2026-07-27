/**
 * ChangelogPopover — the shared house record-history affordance (Danny 27-07,
 * §3A(d)): pins the behaviour every entity drawer now shares — the icon opens a
 * focus-trapped 900px dialog, Escape/outside-click closes it, focus returns to the
 * icon on close, and the caller's own content only mounts while the panel is open.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangelogPopover from './ChangelogPopover'

describe('ChangelogPopover', () => {
  it('renders the toggle icon with the given label as its accessible name', () => {
    render(<ChangelogPopover label="Wijzigingen"><div>content</div></ChangelogPopover>)
    expect(screen.getByRole('button', { name: 'Wijzigingen' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the 900px dialog and mounts the children only once opened', async () => {
    const user = userEvent.setup()
    render(<ChangelogPopover label="Wijzigingen"><div>changelog-content</div></ChangelogPopover>)
    expect(screen.queryByText('changelog-content')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Wijzigingen' }))
    const dialog = screen.getByRole('dialog', { name: 'Wijzigingen' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveStyle({ width: '900px' })
    expect(screen.getByText('changelog-content')).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the toggle icon', async () => {
    const user = userEvent.setup()
    render(<ChangelogPopover label="Wijzigingen"><div>content</div></ChangelogPopover>)
    const toggle = screen.getByRole('button', { name: 'Wijzigingen' })

    await user.click(toggle)
    const dialog = screen.getByRole('dialog', { name: 'Wijzigingen' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(toggle)
  })

  it('closes on outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button>outside</button>
        <ChangelogPopover label="Wijzigingen"><div>content</div></ChangelogPopover>
      </div>,
    )
    await user.click(screen.getByRole('button', { name: 'Wijzigingen' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Mirrors the outside-click convention used elsewhere (SearchSelect.test.tsx):
    // the handler listens on 'mousedown', so trigger that directly.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on the global km:open-changelog event (a NotesTab system-row icon, any entity)', () => {
    render(<ChangelogPopover label="Wijzigingen"><div>content</div></ChangelogPopover>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent(window, new CustomEvent('km:open-changelog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('marks the toggle as expanded via aria-expanded while open', async () => {
    const user = userEvent.setup()
    render(<ChangelogPopover label="Wijzigingen"><div>content</div></ChangelogPopover>)
    const toggle = screen.getByRole('button', { name: 'Wijzigingen' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
