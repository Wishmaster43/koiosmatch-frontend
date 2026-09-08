/**
 * PopoutErrorShell.test — unit tests for the shared error shell.
 * Verifies PopoutShell integration and error state rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PopoutErrorShell from './PopoutErrorShell'
import type { ReactNode } from 'react'

interface PopoutShellProps {
  loading: boolean
  error: boolean
  onRetry: () => void
  loadingLabel: string
  errorLabel: string
  retryLabel: string
  name: string
  initials: string
  subtitle: string
  children: ReactNode
}

vi.mock('@/pages/popout/shared', () => ({
  PopoutShell: ({
    error,
    errorLabel,
    retryLabel,
    onRetry,
  }: PopoutShellProps) =>
    error ? (
      <div data-testid="popout-error">
        <div data-testid="error-message">{errorLabel}</div>
        <button data-testid="retry-button" onClick={onRetry}>
          {retryLabel}
        </button>
      </div>
    ) : null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'error.retry') return 'Retry'
      return key
    },
  }),
}))

describe('PopoutErrorShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders error state with the provided label', () => {
    render(<PopoutErrorShell label="Unknown entity" onRetry={vi.fn()} />)

    expect(screen.getByTestId('popout-error')).toBeInTheDocument()
    expect(screen.getByTestId('error-message')).toHaveTextContent('Unknown entity')
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()

    render(<PopoutErrorShell label="Test error" onRetry={handleRetry} />)

    await user.click(screen.getByTestId('retry-button'))

    expect(handleRetry).toHaveBeenCalledOnce()
  })

  it('renders retry label from translation', () => {
    render(<PopoutErrorShell label="Error" onRetry={vi.fn()} />)

    expect(screen.getByTestId('retry-button')).toHaveTextContent('Retry')
  })
})
