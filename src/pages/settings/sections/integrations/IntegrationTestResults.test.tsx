/**
 * IntegrationTestResults.test — dual (SM-CREDS-2) and legacy render paths.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import IntegrationTestResults from './IntegrationTestResults'

const t = (key: string | string[], opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts }) as string

describe('IntegrationTestResults', () => {
  it('renders one line per API for a dual result, one ok one failed', () => {
    render(
      <IntegrationTestResults
        t={t}
        result={{
          ok: false,
          results: {
            token_api: { ok: true, connected_as: 'Bureau X' },
            company_api: { ok: false, reason_code: 'not_configured', message: 'No auth token set.' },
          },
          correlation_id: 'corr-1',
        }}
      />,
    )
    expect(screen.getByText(t('integrations.connection.tokenApiTitle'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.companyApiTitle'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.testOk', { name: 'Bureau X' }))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(t('integrations.reason.not_configured')))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.correlation', { id: 'corr-1' }))).toBeInTheDocument()
  })

  it('renders the legacy single success callout', () => {
    render(<IntegrationTestResults t={t} result={{ ok: true, connected_as: 'Bureau Y', details: {} }} />)
    expect(screen.getByText(t('integrations.connection.testOk', { name: 'Bureau Y' }))).toBeInTheDocument()
  })

  it('renders the legacy single failure callout with reason/message/correlation', () => {
    render(
      <IntegrationTestResults
        t={t}
        result={{ ok: false, reason_code: 'auth_failed', message: 'Invalid API key.', correlation_id: 'corr-2' }}
      />,
    )
    expect(screen.getByText(t('integrations.reason.auth_failed'))).toBeInTheDocument()
    expect(screen.getByText('Invalid API key.')).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.correlation', { id: 'corr-2' }))).toBeInTheDocument()
  })
})
