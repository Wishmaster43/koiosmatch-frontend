/**
 * CopyIconButton — verifies the shared click-to-copy atom: writes to the
 * clipboard, flashes the Check icon, and fires the success toast.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CopyIconButton from './CopyIconButton'

vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn() }))

describe('CopyIconButton', () => {
  it('renders nothing without a value', () => {
    const { container } = render(<CopyIconButton label="Kopieer adres" copiedLabel="Adres gekopieerd" value={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('copies the value to the clipboard and flashes a success toast', async () => {
    const { notifySuccess } = await import('@/lib/notify')

    // userEvent.setup() installs its own in-memory clipboard stub on
    // navigator.clipboard (jsdom ships none) — spy AFTER setup so the spy
    // wraps that stub instead of being overwritten by it.
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    render(<CopyIconButton label="Kopieer adres" copiedLabel="Adres gekopieerd" value="Kerkstraat 1, 1234 AB Amsterdam" />)
    await user.click(screen.getByRole('button'))

    expect(writeTextSpy).toHaveBeenCalledWith('Kerkstraat 1, 1234 AB Amsterdam')
    expect(notifySuccess).toHaveBeenCalled()
  })
})
