/** integrationConnectionCard · dual credentials and sync line (split from integrationConnectionCard.test.tsx; SM-CREDS-2 company_api group and the Shiftmanager last-sync status line). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import IntegrationConnectionCard from './IntegrationConnectionCard'
import {
  getIntegrationSettings,
  putIntegrationSettings,
  testIntegration,
} from './integrationsApi'

// The dashboard sync lookup is mocked: no QueryClient, no network.
const mockSync = vi.fn()
vi.mock('@/components/shiftmanager/useSmLastSync', () => ({ useSmLastSync: (enabled: boolean) => mockSync(enabled) }))

// The health hook is mocked: no QueryClient; refresh is asserted in the health tests.
const mockRefresh = vi.fn()
vi.mock('./useIntegrationHealth', () => ({
  useIntegrationHealth: () => ({ health: { state: 'unknown', errorCode: null, errorMessage: null, checkedAt: null }, refresh: mockRefresh }),
}))

vi.mock('./integrationsApi', () => ({
  getIntegrationSettings: vi.fn(),
  putIntegrationSettings: vi.fn(),
  testIntegration: vi.fn(),
}))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const mockGet = getIntegrationSettings as unknown as ReturnType<typeof vi.fn>
const mockPut = putIntegrationSettings as unknown as ReturnType<typeof vi.fn>
const mockTest = testIntegration as unknown as ReturnType<typeof vi.fn>

afterEach(() => vi.clearAllMocks())

// Waits out the load-once effect and returns once the title has rendered.
async function renderCard(connector: 'shiftmanager' | 'helloflex' | 'werkzoeken') {
  render(<IntegrationConnectionCard connector={connector} />)
  await screen.findByText(t('integrations.connection.title'))
}

// SM-CREDS-2: both Shiftmanager credential sets on one card, feature-detected
// on `subdomain`/`has_auth_token` so a BE that has not landed it yet leaves the
// card exactly as the field-spec tests in integrationConnectionCard.test.tsx
// (old face, old PUT body).
describe('SM-CREDS-2 dual credentials', () => {
  // (b) new GET shape → both groups render.
  it('renders both credential groups once the GET carries subdomain + has_auth_token', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: 'yesway-nl', has_auth_token: true, connected_as: 'Bureau X',
    })
    await renderCard('shiftmanager')
    expect(screen.getByText(t('integrations.connection.tokenApiTitle'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.companyApiTitle'))).toBeInTheDocument()
    expect(screen.getByDisplayValue('yesway')).toBeInTheDocument()
    expect(screen.getByDisplayValue('yesway-nl')).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.authToken'))).toBeInTheDocument()
  })

  // Feature detection: has_auth_token key ABSENT → company_api group stays hidden
  // (the BE half genuinely has not landed that field yet).
  it('hides the company_api group when has_auth_token is absent entirely', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true, connected_as: null,
    })
    await renderCard('shiftmanager')
    expect(screen.getByText(t('integrations.connection.tokenApiTitle'))).toBeInTheDocument()
    expect(screen.queryByText(t('integrations.connection.companyApiTitle'))).not.toBeInTheDocument()
  })

  // Feature detection is on the KEY, not the value: has_auth_token: false still
  // shows the group (Yesway's first save, before any auth_token was ever set).
  it('shows the company_api group when has_auth_token is present but false', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: null, has_auth_token: false, connected_as: null,
    })
    await renderCard('shiftmanager')
    expect(screen.getByText(t('integrations.connection.companyApiTitle'))).toBeInTheDocument()
    expect(screen.getByLabelText(t('integrations.connection.company'))).toBeInTheDocument()
    expect(screen.getByLabelText(t('integrations.connection.authToken'))).toBeInTheDocument()
  })

  // Save body carries subdomain/company/auth_token exactly, secrets only when dirty.
  it('saves subdomain + company + both typed secrets in one PUT body', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'old-sub', base_url: null, has_api_key: true,
      company: 'old-co', has_auth_token: true, connected_as: null,
    })
    mockPut.mockResolvedValue({
      two_way: true, subdomain: 'new-sub', base_url: null, has_api_key: true,
      company: 'new-co', has_auth_token: true, connected_as: null,
    })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    const subdomainInput = screen.getByLabelText(t('integrations.connection.subdomain'))
    await user.clear(subdomainInput)
    await user.type(subdomainInput, 'new-sub')
    const companyInput = screen.getByLabelText(t('integrations.connection.company'))
    await user.clear(companyInput)
    await user.type(companyInput, 'new-co')
    const apiKeyInput = screen.getByLabelText(t('integrations.connection.apiKey'))
    await user.type(apiKeyInput, 'new-api-key')
    const authTokenInput = screen.getByLabelText(t('integrations.connection.authToken'))
    await user.type(authTokenInput, 'new-auth-token')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [connectorArg, body] = mockPut.mock.calls[0]
    expect(connectorArg).toBe('shiftmanager')
    // Exact body: no extra key (base_url, a has_* leak, …) rides along.
    expect(body).toEqual({
      two_way: true,
      subdomain: 'new-sub',
      api_key: 'new-api-key',
      company: 'new-co',
      auth_token: 'new-auth-token',
    })
  })

  // Clearing auth_token sends null, distinct from an untouched api_key.
  it('sends auth_token: null on explicit clear, and never sends an untouched secret', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: 'yesway-nl', has_auth_token: true, connected_as: null,
    })
    mockPut.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: 'yesway-nl', has_auth_token: false, connected_as: null,
    })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    // Both api_key and auth_token are "Set" here, so two clear buttons render —
    // auth_token's is the second (it follows api_key in the token_api/company_api order).
    const clearButtons = screen.getAllByRole('button', { name: t('integrations.connection.clearSecret') })
    await user.click(clearButtons[1])
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [, body] = mockPut.mock.calls[0]
    expect(body.auth_token).toBeNull()
    expect(body).not.toHaveProperty('api_key')
    // The group stays visible after save even though has_auth_token is now
    // false — the field key is still present, so it can be re-entered.
    expect(screen.getByText(t('integrations.connection.companyApiTitle'))).toBeInTheDocument()
  })

  // Test with dual results → two lines, one ok one failed with the translated reason.
  it('renders two result lines for a dual test outcome', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: 'yesway-nl', has_auth_token: true, connected_as: null,
    })
    mockTest.mockResolvedValue({
      ok: false,
      results: {
        token_api: { ok: true, connected_as: 'Bureau X' },
        company_api: { ok: false, reason_code: 'not_configured', message: 'No auth token set.' },
      },
      correlation_id: 'corr-9',
    })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    await user.click(screen.getByRole('button', { name: t('integrations.connection.testBoth') }))
    await screen.findByText(t('integrations.connection.testOk', { name: 'Bureau X' }))
    expect(screen.getByText(new RegExp(t('integrations.reason.not_configured')))).toBeInTheDocument()
  })

  // Test with a legacy result (BE has not landed the dual shape) → single callout, unchanged.
  it('renders the legacy single callout for a legacy test outcome', async () => {
    mockGet.mockResolvedValue({
      two_way: true, subdomain: 'yesway', base_url: null, has_api_key: true,
      company: 'yesway-nl', has_auth_token: true, connected_as: null,
    })
    mockTest.mockResolvedValue({ ok: true, connected_as: 'Bureau Z', details: {} })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    await user.click(screen.getByRole('button', { name: t('integrations.connection.testBoth') }))
    const matches = await screen.findAllByText(t('integrations.connection.testOk', { name: 'Bureau Z' }))
    expect(matches.length).toBeGreaterThan(0)
  })
})

describe('Shiftmanager sync status line (ONIX G-012)', () => {
  it('saved connection and no sync yet: shows "not active yet"', async () => {
    mockSync.mockReturnValue(null)
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: null })
    await renderCard('shiftmanager')
    expect(screen.getByText(t('integrations.connection.notActiveYet'))).toBeInTheDocument()
    expect(mockSync).toHaveBeenCalledWith(true)
  })

  it('saved connection with a sync timestamp: shows the formatted time instead', async () => {
    mockSync.mockReturnValue('2026-10-09T12:30:00')
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    await renderCard('shiftmanager')
    expect(screen.queryByText(t('integrations.connection.notActiveYet'))).not.toBeInTheDocument()
    expect(screen.getByText(/09-10-2026 12:30/)).toBeInTheDocument()
  })

  it('helloflex renders neither line and does not enable the lookup', async () => {
    mockSync.mockReturnValue(null)
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: 'c', has_client_secret: true, connected_as: 'X' })
    await renderCard('helloflex')
    expect(screen.queryByText(t('integrations.connection.notActiveYet'))).not.toBeInTheDocument()
    expect(screen.queryByText(/09-10-2026/)).not.toBeInTheDocument()
    expect(mockSync).toHaveBeenCalledWith(false)
  })
})

// HF-CONNECTION-STATUS-1: shared health badge, honest Test, GUID check, refresh after save/test.
describe('connection health and honest test', () => {
  // Both connectors mount the same badge.
  it('mounts the health badge for helloflex and shiftmanager', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: '', has_client_secret: false, connected_as: null })
    await renderCard('helloflex')
    expect(screen.getByTestId('integration-health')).toBeInTheDocument()
  })

  it('mounts the health badge for shiftmanager', async () => {
    mockGet.mockResolvedValue({ two_way: true, has_api_key: false, connected_as: null })
    await renderCard('shiftmanager')
    expect(screen.getByTestId('integration-health')).toBeInTheDocument()
  })

  // A dirty form disables Test and says why; the test posts nothing.
  it('disables Test while dirty with the save-first caption', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: '', has_client_secret: false, connected_as: null })
    await renderCard('helloflex')
    await userEvent.type(screen.getByLabelText(t('integrations.connection.clientId')), 'x')
    expect(screen.getByRole('button', { name: t('integrations.connection.test') })).toBeDisabled()
    expect(screen.getByText(t('integrations.connection.saveBeforeTest'))).toBeInTheDocument()
    expect(mockTest).not.toHaveBeenCalled()
  })

  // A non-GUID client id blocks Save; a valid one enables it and the PUT carries it.
  it('blocks Save on an invalid GUID and refreshes health after save', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: '', has_client_secret: false, connected_as: null })
    await renderCard('helloflex')
    const input = screen.getByLabelText(t('integrations.connection.clientId'))
    await userEvent.type(input, 'not-a-guid')
    expect(screen.getByText(t('integrations.connection.clientIdInvalid'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
    const guid = '123e4567-e89b-12d3-a456-426614174000'
    await userEvent.clear(input)
    await userEvent.type(input, guid)
    mockPut.mockResolvedValue({ two_way: false, environment: 'uat', client_id: guid, has_client_secret: false, connected_as: null })
    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('helloflex', expect.objectContaining({ client_id: guid })))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  // Running the test refreshes the stored health.
  it('refreshes health after a test', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: '', has_client_secret: true, connected_as: null })
    mockTest.mockResolvedValue({ ok: true, connected_as: 'X' })
    await renderCard('helloflex')
    await userEvent.click(screen.getByRole('button', { name: t('integrations.connection.test') }))
    await waitFor(() => expect(mockTest).toHaveBeenCalledWith('helloflex'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })
})
