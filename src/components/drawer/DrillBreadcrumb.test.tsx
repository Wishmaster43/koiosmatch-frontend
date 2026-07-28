/**
 * DrillBreadcrumb · the one way back out of a nested drill-down. Covers: every
 * trail entry is a real, independently-clickable button; `current` is plain
 * text (never a button — the contract is you cannot navigate to where you
 * already are); one- and three-entry trails both render; the nav exposes an
 * accessible name.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DrillBreadcrumb, { type Crumb } from './DrillBreadcrumb'

const ct = (key: string) => i18n.t(key, { ns: 'common' })

describe('DrillBreadcrumb · trail buttons each call their own onClick', () => {
  it('renders every trail entry as a real button, independently clickable', async () => {
    const user = userEvent.setup()
    const first = vi.fn()
    const second = vi.fn()
    const trail: Crumb[] = [
      { label: 'Klanten', onClick: first },
      { label: 'Acme B.V.', onClick: second },
    ]
    render(<DrillBreadcrumb trail={trail} current="Contactpersoon" />)

    const nav = screen.getByRole('navigation')
    await user.click(within(nav).getByRole('button', { name: 'Klanten' }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    await user.click(within(nav).getByRole('button', { name: 'Acme B.V.' }))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
  })
})

describe('DrillBreadcrumb · `current` is text, never a button', () => {
  it('renders the current level as plain text — you cannot navigate to where you already are', () => {
    const trail: Crumb[] = [{ label: 'Klanten', onClick: vi.fn() }]
    render(<DrillBreadcrumb trail={trail} current="Acme B.V." />)
    expect(screen.getByText('Acme B.V.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acme B.V.' })).toBeNull()
  })
})

describe('DrillBreadcrumb · trail depth', () => {
  it('renders a one-entry trail', () => {
    render(<DrillBreadcrumb trail={[{ label: 'Klanten', onClick: vi.fn() }]} current="Acme B.V." />)
    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Acme B.V.')).toBeInTheDocument()
  })

  it('renders a three-entry trail', () => {
    const trail: Crumb[] = [
      { label: 'Klanten', onClick: vi.fn() },
      { label: 'Vestiging Noord', onClick: vi.fn() },
      { label: 'Zorg', onClick: vi.fn() },
    ]
    render(<DrillBreadcrumb trail={trail} current="Eva Bos" />)
    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText('Eva Bos')).toBeInTheDocument()
  })
})

describe('DrillBreadcrumb · accessibility', () => {
  it('exposes an accessible name on the nav', () => {
    render(<DrillBreadcrumb trail={[]} current="Eva Bos" />)
    expect(screen.getByRole('navigation', { name: ct('breadcrumb') })).toBeInTheDocument()
  })
})
