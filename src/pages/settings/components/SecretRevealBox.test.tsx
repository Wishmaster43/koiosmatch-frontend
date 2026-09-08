/**
 * SecretRevealBox — test that it displays the secret in a monospace field
 * and the copy button works with the confirmation flash.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SecretRevealBox from './SecretRevealBox'

describe('SecretRevealBox', () => {
  beforeEach(() => {
    // Mock clipboard.writeText
    vi.stubGlobal(
      'navigator',
      {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      }
    )
  })

  it('renders the secret in a code block', () => {
    render(
      <SecretRevealBox
        secret="my-secret-key-123"
        copyLabel="Copy"
        copiedLabel="Copied"
      />
    )
    expect(screen.getByText('my-secret-key-123')).toBeInTheDocument()
  })

  it('renders the copy button with the correct label', () => {
    render(
      <SecretRevealBox
        secret="secret"
        copyLabel="Copy Secret"
        copiedLabel="Copied!"
      />
    )
    expect(screen.getByText('Copy Secret')).toBeInTheDocument()
  })

  it('copies the secret to clipboard when button is clicked', async () => {
    const { getByText } = render(
      <SecretRevealBox
        secret="test-secret"
        copyLabel="Copy"
        copiedLabel="Copied"
      />
    )
    const copyButton = getByText('Copy')
    copyButton.click()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-secret')
  })

  it('shows copied confirmation momentarily', async () => {
    render(
      <SecretRevealBox
        secret="secret"
        copyLabel="Copy"
        copiedLabel="Copied"
      />
    )
    const copyButton = screen.getByText('Copy')
    copyButton.click()
    // After click, should show "Copied" momentarily
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument()
    })
  })
})
