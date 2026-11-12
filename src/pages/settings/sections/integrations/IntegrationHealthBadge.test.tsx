/** IntegrationHealthBadge: three states, HH:mm check time, error code label or server text. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import IntegrationHealthBadge from './IntegrationHealthBadge'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const none = { errorCode: null, errorMessage: null, checkedAt: null }

describe('IntegrationHealthBadge', () => {
  // The three states render their own text.
  it('renders ok, error and unknown texts', () => {
    const { rerender } = render(<IntegrationHealthBadge health={{ ...none, state: 'ok' }} />)
    expect(screen.getByText(t('integrations.health.ok'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ ...none, state: 'error' }} />)
    expect(screen.getByText(t('integrations.health.error'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ ...none, state: 'unknown' }} />)
    expect(screen.getByText(t('integrations.health.unknown'))).toBeInTheDocument()
  })

  // The check time is a local HH:mm, never an ISO string.
  it('shows the check time as HH:mm', () => {
    render(<IntegrationHealthBadge health={{ ...none, state: 'ok', checkedAt: '2026-11-12T10:05:00' }} />)
    expect(screen.getByText(t('integrations.health.checkedAt', { time: '10:05' }))).toBeInTheDocument()
    expect(screen.queryByText(/2026-11-12/)).not.toBeInTheDocument()
  })

  // A known code shows its translated label; an unknown code falls back to the server text.
  it('shows the code label, else the server message', () => {
    const { rerender } = render(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'auth_failed', errorMessage: 'raw', checkedAt: null }} />)
    expect(screen.getByText(t('integrations.reason.auth_failed'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'weird', errorMessage: 'Server says no', checkedAt: null }} />)
    expect(screen.getByText('Server says no')).toBeInTheDocument()
  })
})
