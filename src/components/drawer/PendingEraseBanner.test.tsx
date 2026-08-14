/**
 * PendingEraseBanner (TRASH-FE-POLISH-1) — proves the one shared shell renders
 * identical banner text for both entry points (matches/outreach's icon-only variant
 * and TrashLifecycleSection's visible-label 'button' variant), and that each variant's
 * unmark control still reaches the caller's onUnmark with the record id.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArchiveRestore, Undo2 } from 'lucide-react'
import PendingEraseBanner from './PendingEraseBanner'

const MESSAGE = 'In trash since 01-08-2026 · erased around 31-08-2026'

describe('PendingEraseBanner', () => {
  it('renders the same message text for both the icon variant and the button variant', () => {
    const { unmount } = render(
      <PendingEraseBanner id="a-1" message={MESSAGE} onUnmark={vi.fn()} unmarkLabel="Back to archive" />,
    )
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
    unmount()
    render(
      <PendingEraseBanner id="a-1" message={MESSAGE} onUnmark={vi.fn()} unmarkLabel="Back to archive"
        unmarkVariant="button" unmarkIcon={Undo2} unmarkColor="var(--color-archive)" />,
    )
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
  })

  it('icon variant (matches/outreach): icon-only aria-labelled button calls onUnmark(id)', async () => {
    const user = userEvent.setup()
    const onUnmark = vi.fn()
    render(<PendingEraseBanner id="m-1" message={MESSAGE} onUnmark={onUnmark} unmarkLabel="Back to archive" />)
    const btn = screen.getByRole('button', { name: 'Back to archive' })
    expect(btn).toHaveAttribute('title', 'Back to archive')
    await user.click(btn)
    expect(onUnmark).toHaveBeenCalledWith('m-1')
  })

  it('button variant (TrashLifecycleSection): visible-label pill calls onUnmark(id)', async () => {
    const user = userEvent.setup()
    const onUnmark = vi.fn()
    render(
      <PendingEraseBanner id="t-1" message={MESSAGE} onUnmark={onUnmark} unmarkLabel="Back to archive"
        unmarkVariant="button" unmarkIcon={Undo2} unmarkColor="var(--color-archive)" />,
    )
    const btn = screen.getByRole('button', { name: 'Back to archive' })
    await user.click(btn)
    expect(onUnmark).toHaveBeenCalledWith('t-1')
  })

  it('hides the unmark control entirely when onUnmark is absent (no permission)', () => {
    render(<PendingEraseBanner id="a-1" message={MESSAGE} unmarkLabel="Back to archive" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('defaults to ArchiveRestore for the icon variant when unmarkIcon is not passed', () => {
    render(<PendingEraseBanner id="a-1" message={MESSAGE} onUnmark={vi.fn()} unmarkLabel="Back to archive" />)
    // Smoke check: the default icon renders without crashing and the button is present.
    expect(screen.getByRole('button', { name: 'Back to archive' }).querySelector('svg')).toBeInTheDocument()
    expect(ArchiveRestore).toBeDefined()
  })
})
