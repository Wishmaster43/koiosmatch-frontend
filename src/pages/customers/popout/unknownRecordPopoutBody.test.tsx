import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { unknownRecordPopoutBody } from './unknownRecordPopoutBody'

// Deep-path stub of the shared body (never the barrel) — captures the props this unit builds.
const bodyProps = vi.fn()
vi.mock('./SharedTextPopoutBody', () => ({
  default: (props: Record<string, unknown>) => { bodyProps(props); return <div data-testid="popout-body" /> },
}))

const t = ((key: string) => key) as unknown as TFunction

describe('unknownRecordPopoutBody', () => {
  it('renders the honest error state with empty name/subtitle/text and no loading', () => {
    const onRetry = vi.fn()
    render(<>{unknownRecordPopoutBody(t, onRetry)}</>)

    expect(screen.getByTestId('popout-body')).toBeInTheDocument()
    expect(bodyProps).toHaveBeenCalledWith(expect.objectContaining({
      loading: false, error: true, name: '', subtitle: '', text: '', dirty: false,
      errorLabel: 'popout.loadError', retryLabel: 'common:error.retry',
    }))
  })

  it('wires onRetry straight through as onRetry', () => {
    const onRetry = vi.fn()
    render(<>{unknownRecordPopoutBody(t, onRetry)}</>)
    const { onRetry: passed } = bodyProps.mock.calls[bodyProps.mock.calls.length - 1][0] as { onRetry: () => void }
    passed()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('onSave resolves false without side effects (a malformed id has nothing to save)', async () => {
    render(<>{unknownRecordPopoutBody(t, vi.fn())}</>)
    const { onSave } = bodyProps.mock.calls[bodyProps.mock.calls.length - 1][0] as { onSave: () => Promise<boolean> }
    await expect(onSave()).resolves.toBe(false)
  })
})
