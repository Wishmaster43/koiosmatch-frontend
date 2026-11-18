/** IntegrationHealthBadge: three states, DD-MM-YYYY HH:mm check stamp, error code label or server text. */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { useDateFormat } from '@/lib/datetime'
import IntegrationHealthBadge from './IntegrationHealthBadge'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const none = { errorCode: null, errorMessage: null, checkedAt: null }

describe('IntegrationHealthBadge', () => {
  // Remember the language once and restore it after every test.
  let prevLanguage = ''
  beforeAll(() => { prevLanguage = i18n.language })
  afterEach(async () => { await i18n.changeLanguage(prevLanguage) })

  // The three states render their own text.
  it('renders ok, error and unknown texts', () => {
    const { rerender } = render(<IntegrationHealthBadge health={{ ...none, state: 'ok' }} />)
    expect(screen.getByText(t('integrations.health.ok'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ ...none, state: 'error' }} />)
    expect(screen.getByText(t('integrations.health.error'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ ...none, state: 'unknown' }} />)
    expect(screen.getByText(t('integrations.health.unknown'))).toBeInTheDocument()
  })

  // The check stamp carries the date and the time through the house formatter, never ISO.
  it('shows the check stamp as date and time', () => {
    render(<IntegrationHealthBadge health={{ ...none, state: 'ok', checkedAt: '2026-11-12T10:05:00' }} />)
    const { result } = renderHook(() => useDateFormat())
    const stamp = result.current.formatDateTime('2026-11-12T10:05:00')
    expect(stamp).toContain('12-11-2026')
    expect(stamp).toContain('10:05')
    expect(screen.getByText(t('integrations.health.checkedAt', { time: stamp }))).toBeInTheDocument()
    expect(screen.queryByText(/2026-11-12/)).not.toBeInTheDocument()
  })

  // Connector-prefixed BE codes resolve to the bare translated copy in en and nl.
  it.each(['en', 'nl'])('translates prefixed codes (%s)', async (lng) => {
    await i18n.changeLanguage(lng)
    const tl = (key: string) => i18n.t(key, { ns: 'settings', lng })
    const { rerender } = render(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'sm_auth_failed', errorMessage: 'raw', checkedAt: null }} />)
    expect(screen.getByText(tl('integrations.reason.auth_failed'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'wz_unexpected', errorMessage: 'raw', checkedAt: null }} />)
    expect(screen.getByText(tl('integrations.reason.unexpected'))).toBeInTheDocument()
  })

  // A known code shows its translated label; an unknown code falls back to the server text.
  it('shows the code label, else the server message', () => {
    const { rerender } = render(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'auth_failed', errorMessage: 'raw', checkedAt: null }} />)
    expect(screen.getByText(t('integrations.reason.auth_failed'))).toBeInTheDocument()
    rerender(<IntegrationHealthBadge health={{ state: 'error', errorCode: 'weird', errorMessage: 'Server says no', checkedAt: null }} />)
    expect(screen.getByText('Server says no')).toBeInTheDocument()
  })

  // A failed health request reads as 'unavailable' (never 'not checked yet') and offers a retry.
  it('shows the unavailable line with a working retry', async () => {
    const onRetry = vi.fn()
    render(<IntegrationHealthBadge health={{ ...none, state: 'unknown' }} unavailable onRetry={onRetry} />)
    expect(screen.getByText(t('integrations.health.unavailable'))).toBeInTheDocument()
    expect(screen.queryByText(t('integrations.health.unknown'))).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: i18n.t('error.retry', { ns: 'common' }) }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
