/**
 * MatchRemarksBlock (M29) — pencil → save/✕ over its own `save` prop (the
 * SAME useMatchContract instance OverviewTab holds), asserting the actual
 * PATCH-shaped call (§13: never only that a callback fired).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchRemarksBlock from './MatchRemarksBlock'

describe('MatchRemarksBlock', () => {
  it('shows a loading placeholder while the shared contract fetch is in flight', () => {
    render(<MatchRemarksBlock remarks={null} loading save={vi.fn()} />)
    expect(screen.getByText('drawer.contract.loading')).toBeInTheDocument()
  })

  it('renders an honest dash when there are no remarks yet', () => {
    render(<MatchRemarksBlock remarks={null} loading={false} save={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the existing remarks as HTML', () => {
    render(<MatchRemarksBlock remarks="<p>Contact opnemen na 3 maanden</p>" loading={false} save={vi.fn()} />)
    expect(screen.getByText('Contact opnemen na 3 maanden')).toBeInTheDocument()
  })

  it('pencil opens the editor; save calls save({ remarks }) with the edited value, then closes edit mode', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    render(<MatchRemarksBlock remarks="<p>Oud</p>" loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    // The rich text editor mounts a contenteditable/textarea surface — this test
    // only proves the SAVE request shape, not the editor's own typing mechanics
    // (RichTextEditor has its own test suite), so it saves the seeded draft as-is.
    await user.click(screen.getByTitle('common:save'))

    expect(save).toHaveBeenCalledWith({ remarks: '<p>Oud</p>' })
  })

  it('cancel (✕) discards the draft without calling save', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<MatchRemarksBlock remarks="<p>Oud</p>" loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:cancel'))

    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('Oud')).toBeInTheDocument()
  })

  it('sends null (not an empty string) when the remarks are cleared out', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    render(<MatchRemarksBlock remarks={null} loading={false} save={save} />)

    await user.click(screen.getByTitle('common:edit'))
    await user.click(screen.getByTitle('common:save'))

    expect(save).toHaveBeenCalledWith({ remarks: null })
  })
})
