/**
 * IntegrationConnectionCard.test — proves the PUT/POST REQUEST shapes per
 * CLAUDE.md §13 (secret write/leave/clear, two_way round-trip), the per-
 * connector field spec, the 422 test-failure render and the success render.
 * './integrationsApi' is mocked (not axios) — the component talks to that
 * module directly.
 */
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

describe('per-connector field spec', () => {
  // shiftmanager: two_way + base_url + api_key (secret) — no environment picker.
  it('renders the shiftmanager fields', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    await renderCard('shiftmanager')
    expect(screen.getByDisplayValue('https://sm.example')).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.secretSet'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.connectedAs', { name: 'Bureau X' }))).toBeInTheDocument()
    expect(screen.queryByText(t('integrations.connection.environment'))).not.toBeInTheDocument()
  })

  // helloflex: environment picker + client_id + client_secret (secret); no two_way
  // switch until a push-sync exists (question 119, Danny 08-09: A).
  it('renders the helloflex fields including the environment picker, without the two-way switch', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: 'cid-1', has_client_secret: false, connected_as: null })
    await renderCard('helloflex')
    expect(screen.getByText(t('integrations.connection.environment'))).toBeInTheDocument()
    expect(screen.queryByText(t('integrations.connection.twoWay'))).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('cid-1')).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.secretNotSet'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.notConnected'))).toBeInTheDocument()
  })

  // werkzoeken: api_key (secret) only — no base_url/client_id and no two_way switch (question 119).
  it('renders the werkzoeken fields', async () => {
    mockGet.mockResolvedValue({ two_way: true, has_api_key: false, connected_as: null })
    await renderCard('werkzoeken')
    expect(screen.queryByText(t('integrations.connection.twoWay'))).not.toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.apiKey'))).toBeInTheDocument()
    expect(screen.queryByLabelText(t('integrations.connection.baseUrl'))).not.toBeInTheDocument()
  })

  // No native <select> anywhere on the card — every picker is SelectMenu (CLAUDE.md §3A).
  it('never renders a native <select>', async () => {
    mockGet.mockResolvedValue({ two_way: false, environment: 'uat', client_id: null, has_client_secret: false, connected_as: null })
    const { container } = render(<IntegrationConnectionCard connector="helloflex" />)
    await screen.findByText(t('integrations.connection.title'))
    expect(container.querySelector('select')).toBeNull()
  })
})

describe('save request body', () => {
  // Untouched secret: the PUT body carries no api_key field at all.
  it('omits the secret field when untouched', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    mockPut.mockResolvedValue({ two_way: false, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    // Flip two_way so the form is dirty without touching the secret field.
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [connectorArg, body] = mockPut.mock.calls[0]
    expect(connectorArg).toBe('shiftmanager')
    expect(body).not.toHaveProperty('api_key')
    expect(body.two_way).toBe(false)
  })

  // Typed secret: the PUT body carries the new value verbatim.
  it('sends the typed value when the secret is edited', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    mockPut.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    const secretInput = screen.getByPlaceholderText(t('integrations.connection.secretPlaceholder'))
    await user.type(secretInput, 'new-secret-value')
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [, body] = mockPut.mock.calls[0]
    expect(body.api_key).toBe('new-secret-value')
  })

  // Explicit clear: the PUT body carries null, never absence or an empty string.
  it('sends null when the secret is explicitly cleared', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    mockPut.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: false, connected_as: 'Bureau X' })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    await user.click(screen.getByRole('button', { name: t('integrations.connection.clearSecret') }))
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [, body] = mockPut.mock.calls[0]
    expect(body.api_key).toBeNull()
  })
})

describe('test connection', () => {
  // Success: renders the connected-as message with the server's name.
  it('shows testOk with the connected name on success', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: null, has_api_key: false, connected_as: null })
    mockTest.mockResolvedValue({ ok: true, connected_as: 'Bureau Y', details: {} })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    await user.click(screen.getByRole('button', { name: t('integrations.connection.test') }))
    const matches = await screen.findAllByText(t('integrations.connection.testOk', { name: 'Bureau Y' }))
    expect(matches.length).toBeGreaterThan(0)
  })

  // 422: renders the reason-code label, the server message and the correlation id.
  it('shows the reason, message and correlation id on a 422', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: null, has_api_key: false, connected_as: null })
    mockTest.mockRejectedValue({
      response: { data: { ok: false, reason_code: 'auth_failed', message: 'Invalid API key.', correlation_id: 'corr-123' } },
    })
    const user = userEvent.setup()
    await renderCard('shiftmanager')

    await user.click(screen.getByRole('button', { name: t('integrations.connection.test') }))
    await screen.findByText(t('integrations.reason.auth_failed'))
    expect(screen.getByText('Invalid API key.')).toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.correlation', { id: 'corr-123' }))).toBeInTheDocument()
  })
})

describe('states', () => {
  // Load error renders the error message and a retry button, never a blank screen.
  it('renders a load error whose retry button is NAMED retry and really refetches', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    mockGet.mockResolvedValueOnce({ two_way: true, base_url: null, has_api_key: false, connected_as: null })
    render(<IntegrationConnectionCard connector="shiftmanager" />)
    await screen.findByText(t('integrations.connection.loadError'))

    const retryLabel = i18n.t('error.retry', { ns: 'common' }) as string
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: retryLabel }))
    // The retry runs through the SAME guarded effect (loadTick), so a second GET fires.
    await screen.findByText(t('integrations.connection.title'))
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  // Regression (verify finding): the PUT body never carries server-derived fields.
  it('save body carries only writable keys — never has_* or connected_as', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    mockPut.mockResolvedValue({ two_way: false, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [, body] = mockPut.mock.calls[0]
    expect(body).not.toHaveProperty('has_api_key')
    expect(body).not.toHaveProperty('connected_as')
    // base_url is unchanged, so it never rides the PUT (super-admin-only override).
    expect(Object.keys(body).sort()).toEqual(['two_way'])
  })

  // base_url IS sent when the user actually edits it.
  it('sends base_url when it was actually edited', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: 'https://sm.example', has_api_key: true, connected_as: 'Bureau X' })
    mockPut.mockResolvedValue({ two_way: true, base_url: 'https://sm2.example', has_api_key: true, connected_as: 'Bureau X' })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    const baseUrlInput = screen.getByDisplayValue('https://sm.example')
    await user.clear(baseUrlInput)
    await user.type(baseUrlInput, 'https://sm2.example')
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const [, body] = mockPut.mock.calls[0]
    expect(body.base_url).toBe('https://sm2.example')
  })

  // Regression (verify finding): a successful test never makes the form dirty.
  it('a successful connection test leaves Save disabled', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: null, has_api_key: false, connected_as: null })
    mockTest.mockResolvedValue({ ok: true, connected_as: 'Bureau Y', details: {} })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    await user.click(screen.getByRole('button', { name: t('integrations.connection.test') }))
    await screen.findAllByText(t('integrations.connection.testOk', { name: 'Bureau Y' }))
    expect(screen.getByRole('button', { name: t('common.save') })).toBeDisabled()
  })

  // Regression (verify finding): clearing a secret is a visible, undoable intent.
  it('clear shows the pending-clear line; undo restores the untouched state', async () => {
    mockGet.mockResolvedValue({ two_way: true, base_url: null, has_api_key: true, connected_as: null })
    const user = userEvent.setup()
    await renderCard('shiftmanager')
    await user.click(screen.getByRole('button', { name: t('integrations.connection.clearSecret') }))
    expect(screen.getByText(t('integrations.connection.secretPendingClear'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('integrations.connection.undoClear') }))
    expect(screen.queryByText(t('integrations.connection.secretPendingClear'))).not.toBeInTheDocument()
    expect(screen.getByText(t('integrations.connection.secretSet'))).toBeInTheDocument()
  })
})

// SM-CREDS-2: both Shiftmanager credential sets on one card, feature-detected
// on `subdomain`/`has_auth_token` so a BE that has not landed it yet leaves the
// card exactly as tested above (old face, old PUT body).
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
