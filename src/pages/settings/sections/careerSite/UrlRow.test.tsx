/**
 * UrlRow — dumb component tests: renders the URL, copies it to the clipboard on
 * click (§13: asserts the real clipboard call, not just that a handler fired),
 * shows the "copied" confirmation, and swaps the open-link for a disabled,
 * non-navigating placeholder + notice when the endpoint is currently gated off.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UrlRow from './UrlRow'

const BASE_PROPS = {
  label: 'Sitemap',
  url: 'http://koiosmatch-api.test/api/public/yesway/sitemap.xml',
  copyLabel: 'Copy',
  copiedLabel: 'Copied!',
  openLabel: 'Open',
}

afterEach(() => vi.restoreAllMocks())

describe('UrlRow', () => {
  it('renders the URL and a real external link with a safe rel', () => {
    render(<UrlRow {...BASE_PROPS} />)
    expect(screen.getByText(BASE_PROPS.url)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Open' })
    expect(link).toHaveAttribute('href', BASE_PROPS.url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('copies the URL to the clipboard and shows the confirmation', async () => {
    render(<UrlRow {...BASE_PROPS} />)

    // userEvent.setup() installs its own real (in-memory) clipboard stub on
    // navigator.clipboard (jsdom itself ships none) — spy AFTER setup so the
    // spy wraps that stub instead of being overwritten by it (mirrors
    // ProposalsBlock.test.tsx's documented house pattern for this exact gotcha).
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByRole('button', { name: /Copy/ }))

    expect(writeTextSpy).toHaveBeenCalledWith(BASE_PROPS.url)
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('renders a non-navigating placeholder + notice when gated off, never a broken link', () => {
    render(<UrlRow {...BASE_PROPS} notice="Unavailable while the career site is off" disabledOpen />)
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.getByText('Unavailable while the career site is off')).toBeInTheDocument()
  })
})
