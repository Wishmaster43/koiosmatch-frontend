/**
 * WhatsAppMetaWebhookCard.test — X-26 FE half: verify-token and app-secret
 * status display, CalloutBox warning when app-secret is missing, four UI states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import WhatsAppMetaWebhookCard from './WhatsAppMetaWebhookCard'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn() } }
})

// Mock react-i18next with inline translations for the new keys
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'webhooks.meta.verifyTokenSet': 'Verify token set',
          'webhooks.meta.verifyTokenMissing': 'Verify token missing',
          'webhooks.meta.appSecretSet': 'App secret set',
          'webhooks.meta.appSecretMissing': 'App secret missing',
          'webhooks.meta.appSecretWarning': 'App secret missing: Meta webhooks will not be verified and inbound messages will be rejected.',
          'webhooks.meta.loadError': 'Failed to load webhook configuration',
        }
        return translations[key] ?? key
      },
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  }
})

// Helper to get translated text (uses mocked translations)
const st = (key: string): string => {
  const translations: Record<string, string> = {
    'webhooks.meta.verifyTokenSet': 'Verify token set',
    'webhooks.meta.verifyTokenMissing': 'Verify token missing',
    'webhooks.meta.appSecretSet': 'App secret set',
    'webhooks.meta.appSecretMissing': 'App secret missing',
    'webhooks.meta.appSecretWarning': 'App secret missing: Meta webhooks will not be verified and inbound messages will be rejected.',
    'webhooks.meta.loadError': 'Failed to load webhook configuration',
  }
  return translations[key] ?? key
}

let rowCounter = 0
const row = (over: Partial<WhatsappConnectionRow> = {}): WhatsappConnectionRow => ({
  id: `conn-${++rowCounter}`, waba_id: '10229012934', label: 'Yesway Flex', location_id: null, role_name: null,
  is_default: false, has_verify_token: false, has_app_secret: false, provider: 'meta', status: 'active', ...over,
})

describe('WhatsAppMetaWebhookCard · four UI states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rowCounter = 0
  })

  it('loading', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {})) // Never resolves
    render(<WhatsAppMetaWebhookCard />)
    // The card shows the callback URL even during loading, but no connection list until ready.
    expect(screen.getByText(/whatsapp\/webhook/)).toBeInTheDocument()
  })

  it('error', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => expect(screen.getByText(st('webhooks.meta.loadError'))).toBeInTheDocument())
  })

  it('empty list — no connections rendered', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => expect(screen.queryByText('10229012934')).not.toBeInTheDocument())
  })

  it('success — renders connections with both verify-token and app-secret status', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        row({ has_verify_token: true, has_app_secret: true }),
        row({ has_verify_token: false, has_app_secret: false }),
      ],
    })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => {
      // Check for the label rendered (component shows label ?? waba_id)
      expect(screen.getAllByText('Yesway Flex').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText((content) => content === st('webhooks.meta.verifyTokenSet')).length).toBeGreaterThan(0)
      expect(screen.getAllByText((content) => content === st('webhooks.meta.appSecretSet')).length).toBeGreaterThan(0)
    })
  })
})

describe('WhatsAppMetaWebhookCard · app-secret status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rowCounter = 0
  })

  it('shows app-secret Set when has_app_secret is true', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [row({ has_app_secret: true })],
    })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => {
      expect(screen.getAllByText((content) => content === st('webhooks.meta.appSecretSet')).length).toBeGreaterThan(0)
    })
  })

  it('shows app-secret Missing when has_app_secret is false', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [row({ has_app_secret: false })],
    })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => {
      expect(screen.getAllByText((content) => content === st('webhooks.meta.appSecretMissing')).length).toBeGreaterThan(0)
    })
  })

  it('renders CalloutBox warning only when app-secret is missing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        row({ has_app_secret: true }),
        row({ has_app_secret: false }),
      ],
    })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => {
      const warningText = st('webhooks.meta.appSecretWarning')
      expect(screen.getByText((content) => content === warningText)).toBeInTheDocument()
    })
  })

  it('does not render CalloutBox when app-secret is set', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [row({ has_app_secret: true })],
    })
    render(<WhatsAppMetaWebhookCard />)
    await waitFor(() => {
      const warningText = st('webhooks.meta.appSecretWarning')
      expect(screen.queryByText((content) => content === warningText)).not.toBeInTheDocument()
    })
  })
})
