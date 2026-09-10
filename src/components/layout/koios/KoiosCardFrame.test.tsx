/**
 * KoiosCardFrame — the shared surface + CollapsedCard chrome behind
 * KoiosAssistantBlock and KoiosRadar. Covers the piece those two components'
 * own tests exercise indirectly: the resolved title/close-label render
 * verbatim (no internal t() call), and the close button only appears when
 * onClose is actually given.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosCardFrame from './KoiosCardFrame'

describe('KoiosCardFrame', () => {
  it('renders the caller-resolved title and children when open', () => {
    render(
      <KoiosCardFrame title="Mijn titel" filled open onOpenChange={() => {}} closeLabel="Sluiten">
        <div>row content</div>
      </KoiosCardFrame>,
    )
    expect(screen.getByText('Mijn titel')).toBeInTheDocument()
    expect(screen.getByText('row content')).toBeInTheDocument()
  })

  it('renders no close button when onClose is absent', () => {
    render(
      <KoiosCardFrame title="Titel" filled open onOpenChange={() => {}} closeLabel="Sluiten">
        <div>content</div>
      </KoiosCardFrame>,
    )
    expect(screen.queryAllByRole('button', { name: 'Sluiten' })).toHaveLength(0)
  })

  it('fires onClose with the caller-resolved closeLabel as aria-label when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <KoiosCardFrame title="Titel" filled open onOpenChange={() => {}} onClose={onClose} closeLabel="Sluiten">
        <div>content</div>
      </KoiosCardFrame>,
    )
    const closeBtn = screen.getByRole('button', { name: 'Sluiten' })
    await userEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
