/**
 * BrandSettings — brand colour, text-colour override, logo upload, and company name.
 * Key test: automatic text colour sends '' (not null) to the backend, and a failed save
 * surfaces an error notice (never swallows it silently).
 */
import {describe, it, expect, afterEach, vi} from 'vitest'
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import BrandSettings from './BrandSettings'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocked module functions carry their real call signature via vi.mocked so
// `.mockResolvedValue`/`.mock.calls` stay type-checked against settingsApi.js.
const mockedLoadSettings = vi.mocked(loadSettings)
const mockedSaveSettings = vi.mocked(saveSettings)

// New render wrapper for BrandSettings (like CompanySettings, uses QueryClient).
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BrandSettings /></QueryClientProvider>)

vi.mock('../lib/settingsApi', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}))

vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('BrandSettings — automatic text colour sends empty string, not null', () => {
  it('saves with brand_text_color: "" when automatic (empty) text colour is active', async () => {
    mockedLoadSettings.mockResolvedValue({
      brand_color: 'rgb(59, 143, 212)',
      brand_text_color: '',
      company_name: 'Test Company',
    })
    mockedSaveSettings.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    // Wait for the save button to be available.
    await screen.findByRole('button', { name: t('common.save') })

    // Pick the "Automatisch" (automatic) text colour option.
    const automaticOption = screen.getByRole('button', { name: t('brand.textColorAuto') })
    await user.click(automaticOption)

    // Click save.
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // Assert the request carries brand_text_color: '' (not null).
    await waitFor(() => expect(mockedSaveSettings).toHaveBeenCalled())
    const payload = mockedSaveSettings.mock.calls[0][0]
    expect(payload.brand_text_color).toBe('')
    expect(payload.brand_text_color).not.toBe(null)
  })
})

describe('BrandSettings — failed save shows error notice', () => {
  it('surfaces the backend error via notifyError when save rejects', async () => {
    mockedLoadSettings.mockResolvedValue({
      brand_color: 'rgb(59, 143, 212)',
      brand_text_color: '',
      company_name: 'Test Company',
    })
    mockedSaveSettings.mockRejectedValue({
      response: { data: { message: 'Kleur ongeldig' } },
    })
    const { notifyError } = await import('@/lib/notify')
    const mockedNotifyError = vi.mocked(notifyError)
    const user = userEvent.setup()
    renderPage()

    // Wait for the save button.
    await screen.findByRole('button', { name: t('common.save') })

    // Click save, triggering the rejection.
    await user.click(screen.getByRole('button', { name: t('common.save') }))

    // Assert notifyError was called with the backend message.
    await waitFor(() => expect(mockedNotifyError).toHaveBeenCalled())
    const errorMsg = mockedNotifyError.mock.calls[0][0]
    expect(errorMsg).toBe('Kleur ongeldig')
  })
})
