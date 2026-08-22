import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosHeader from './KoiosHeader'

// t() echoes the key back (no i18n instance mounted here) — same convention
// KoiosRadar.test.tsx relies on.
const t = ((key: string) => key) as unknown as Parameters<typeof KoiosHeader>[0]['t']

const baseProps = {
  expanded: false,
  onNewChat: vi.fn(),
  onToggleExpanded: vi.fn(),
  onClose: vi.fn(),
  onConfigure: vi.fn(),
  t,
}

// CONNECT-1 (Danny 22-08): the disconnected indicator must be a REAL,
// navigable affordance, never a dead-looking chip.
describe('KoiosHeader — connection indicator', () => {
  it('renders the online state as a plain status row — no button, nothing to click', () => {
    render(<KoiosHeader {...baseProps} connected />)
    expect(screen.getByText('koios.online')).toBeInTheDocument()
    expect(screen.queryByText('koios.offline')).toBeNull()
    // Only the three chrome buttons (new chat / expand / close) — no extra one for the status row.
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders the offline state as a real, named button', () => {
    render(<KoiosHeader {...baseProps} connected={false} onConfigure={() => {}} />)
    const button = screen.getByRole('button', { name: 'koios.offlineConnect' })
    expect(button).toBeInTheDocument()
    expect(screen.getByText('koios.offline')).toBeInTheDocument()
  })

  it('clicking the offline indicator calls onConfigure', async () => {
    const user = userEvent.setup()
    const onConfigure = vi.fn()
    render(<KoiosHeader {...baseProps} connected={false} onConfigure={onConfigure} />)
    await user.click(screen.getByRole('button', { name: 'koios.offlineConnect' }))
    expect(onConfigure).toHaveBeenCalledTimes(1)
  })
})

describe('KoiosHeader — chrome buttons', () => {
  it('still wires new chat / expand / close after the Button migration', async () => {
    const user = userEvent.setup()
    const onNewChat = vi.fn()
    const onToggleExpanded = vi.fn()
    const onClose = vi.fn()
    render(<KoiosHeader {...baseProps} connected onNewChat={onNewChat} onToggleExpanded={onToggleExpanded} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'koios.newChatShort' }))
    expect(onNewChat).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'expand' }))
    expect(onToggleExpanded).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'common:close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reflects the expanded state via aria-expanded', () => {
    render(<KoiosHeader {...baseProps} connected expanded />)
    expect(screen.getByRole('button', { name: 'collapse' })).toHaveAttribute('aria-expanded', 'true')
  })
})
