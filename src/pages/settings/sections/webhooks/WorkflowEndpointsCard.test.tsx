/**
 * WorkflowEndpointsCard — tests for the workflow endpoint configuration card.
 * Verifies: rows render from settings blob, blur saves exact key/value, bad slugs
 * never save, and 422 errors display inline.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkflowEndpointsCard from './WorkflowEndpointsCard'

vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useAllSettings: vi.fn(),
    saveSettingsKeys: vi.fn(),
  }
})

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next')
  const allTranslations: Record<string, string> = {
    // Settings namespace
    'webhooks.endpoints.title': 'Workflow endpoints',
    'webhooks.endpoints.hint': 'Configure the URLs that the webhook_send step references.',
    'webhooks.endpoints.slugPlaceholder': 'e.g. elanza, aelio',
    'webhooks.endpoints.urlPlaceholder': 'https://api.example.com/webhook',
    'webhooks.endpoints.add': 'Add endpoint',
    'webhooks.endpoints.remove': 'Remove endpoint',
    'webhooks.endpoints.invalidSlug': 'Slug must contain only lowercase letters, numbers, hyphens, and underscores',
    // Common namespace
    'cancel': 'Cancel',
    'actionFailed': 'Action failed',
  }
  return {
    ...actual,
    useTranslation: vi.fn(() => {
      return {
        t: (key: string) => {
          // Handle namespace prefix (e.g., 'common:cancel' -> 'cancel')
          const resolvedKey = key.includes(':') ? key.split(':')[1] : key
          return allTranslations[resolvedKey] || key
        },
      }
    }),
  }
})

import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'

// Fresh QueryClient per render (i18n is mocked).
function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// Helper to get translated strings from the mock.
function getTranslated(key: string): string {
  const translations: Record<string, string> = {
    'webhooks.endpoints.title': 'Workflow endpoints',
    'webhooks.endpoints.hint': 'Configure the URLs that the webhook_send step references.',
    'webhooks.endpoints.slugPlaceholder': 'e.g. elanza, aelio',
    'webhooks.endpoints.urlPlaceholder': 'https://api.example.com/webhook',
    'webhooks.endpoints.add': 'Add endpoint',
    'webhooks.endpoints.remove': 'Remove endpoint',
    'webhooks.endpoints.invalidSlug': 'Slug must contain only lowercase letters, numbers, hyphens, and underscores',
    'cancel': 'Cancel',
    'actionFailed': 'Action failed',
  }
  // Handle namespace prefix
  const resolvedKey = key.includes(':') ? key.split(':')[1] : key
  return translations[resolvedKey] || key
}

describe('WorkflowEndpointsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => vi.clearAllMocks())

  it('renders rows from the settings blob (webhook_endpoint_* keys)', async () => {
    vi.mocked(useAllSettings).mockReturnValue({
      webhook_endpoint_elanza: 'https://api.elanza.test/webhook',
      webhook_endpoint_aelio: 'https://webhook.aelio.test',
      other_setting: 'ignored',
    })

    renderWithQueryClient(<WorkflowEndpointsCard />)

    await waitFor(() => {
      expect(screen.getByText('elanza')).toBeInTheDocument()
      expect(screen.getByText('aelio')).toBeInTheDocument()
      expect(screen.getByDisplayValue('https://api.elanza.test/webhook')).toBeInTheDocument()
      expect(screen.getByDisplayValue('https://webhook.aelio.test')).toBeInTheDocument()
    })
  })

  it('saves URL on blur, asserting the exact key/value pair', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({
      webhook_endpoint_intus: 'https://old.intus.test',
    })
    vi.mocked(saveSettingsKeys).mockResolvedValue(undefined)

    renderWithQueryClient(<WorkflowEndpointsCard />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://old.intus.test')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('https://old.intus.test')
    await user.clear(input)
    await user.type(input, 'https://new.intus.test')
    await user.click(document.body) // Blur the input

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        webhook_endpoint_intus: 'https://new.intus.test',
      })
    })
  })

  it('does not save if the URL did not change on blur', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({
      webhook_endpoint_test: 'https://test.test',
    })
    vi.mocked(saveSettingsKeys).mockResolvedValue(undefined)

    renderWithQueryClient(<WorkflowEndpointsCard />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://test.test')).toBeInTheDocument()
    })

    // Click and blur without changing.
    const input = screen.getByDisplayValue('https://test.test')
    await user.click(input)
    await user.click(document.body)

    await waitFor(() => {
      expect(saveSettingsKeys).not.toHaveBeenCalled()
    })
  })

  it('does not save a new endpoint with an invalid slug', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({})

    renderWithQueryClient(<WorkflowEndpointsCard />)

    // Click + endpoint.
    await user.click(screen.getByRole('button', { name: getTranslated('webhooks.endpoints.add') }))

    // Fill in an invalid slug (uppercase, special characters).
    const slugInputs = screen.getAllByPlaceholderText(getTranslated('webhooks.endpoints.slugPlaceholder'))
    const slugInput = slugInputs[0]
    await user.type(slugInput, 'Invalid-Slug!')

    // Fill in the URL input.
    const urlInput = screen.getByPlaceholderText(getTranslated('webhooks.endpoints.urlPlaceholder'))
    await user.type(urlInput, 'https://example.test')

    // Blur the URL input to trigger validation and save.
    urlInput.blur()

    // The slug error should appear because the slug is invalid.
    await waitFor(() => {
      expect(screen.getByText(getTranslated('webhooks.endpoints.invalidSlug'))).toBeInTheDocument()
    })

    // Slug was invalid, so no save should have occurred.
    expect(saveSettingsKeys).not.toHaveBeenCalled()
  })

  it('shows a 422 error message inline for a row', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({
      webhook_endpoint_bad: 'https://bad-url.test',
    })
    vi.mocked(saveSettingsKeys).mockRejectedValue(
      new Error('422 Invalid URL')
    )

    renderWithQueryClient(<WorkflowEndpointsCard />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://bad-url.test')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('https://bad-url.test')
    await user.clear(input)
    await user.type(input, 'https://invalid-url')
    input.blur()

    await waitFor(() => {
      expect(screen.getByText(getTranslated('common:actionFailed'))).toBeInTheDocument()
    })
  })

  it('removes an endpoint by saving an empty string', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({
      webhook_endpoint_remove_me: 'https://example.test',
    })
    vi.mocked(saveSettingsKeys).mockResolvedValue(undefined)

    renderWithQueryClient(<WorkflowEndpointsCard />)

    await waitFor(() => {
      expect(screen.getByText('remove_me')).toBeInTheDocument()
    })

    // Click the remove button.
    const removeButtons = screen.getAllByRole('button', { name: getTranslated('webhooks.endpoints.remove') })
    await user.click(removeButtons[0])

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        webhook_endpoint_remove_me: '',
      })
    })
  })

  it('adds a new endpoint with a valid slug and URL', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({})
    vi.mocked(saveSettingsKeys).mockResolvedValue(undefined)

    renderWithQueryClient(<WorkflowEndpointsCard />)

    // Click + endpoint.
    await user.click(screen.getByRole('button', { name: getTranslated('webhooks.endpoints.add') }))

    // Fill in slug and URL.
    const slugInputs = screen.getAllByPlaceholderText(getTranslated('webhooks.endpoints.slugPlaceholder'))
    const slugInput = slugInputs[0]
    const urlInput = screen.getByPlaceholderText(getTranslated('webhooks.endpoints.urlPlaceholder'))

    await user.type(slugInput, 'new_endpoint')
    await user.type(urlInput, 'https://new.endpoint.test')

    // Blur the URL input to trigger the save
    urlInput.blur()

    await waitFor(() => {
      expect(saveSettingsKeys).toHaveBeenCalledWith({
        webhook_endpoint_new_endpoint: 'https://new.endpoint.test',
      })
    })
  })

  it('shows a 422 error when adding a new endpoint fails', async () => {
    const user = userEvent.setup()
    vi.mocked(useAllSettings).mockReturnValue({})
    vi.mocked(saveSettingsKeys).mockRejectedValue(
      new Error('422 Invalid URL')
    )

    renderWithQueryClient(<WorkflowEndpointsCard />)

    // Click + endpoint.
    await user.click(screen.getByRole('button', { name: getTranslated('webhooks.endpoints.add') }))

    // Fill in slug and URL.
    const slugInputs = screen.getAllByPlaceholderText(getTranslated('webhooks.endpoints.slugPlaceholder'))
    const slugInput = slugInputs[0]
    const urlInput = screen.getByPlaceholderText(getTranslated('webhooks.endpoints.urlPlaceholder'))

    await user.type(slugInput, 'bad_endpoint')
    await user.type(urlInput, 'https://bad-url')

    // Blur the URL input to trigger the save.
    urlInput.blur()

    await waitFor(() => {
      expect(screen.getByText(getTranslated('common:actionFailed'))).toBeInTheDocument()
    })
  })
})
