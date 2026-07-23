/**
 * CompanySettings — "Career site active" opt-in toggle (§13: assert the REQUEST
 * payload, never only that a callback fired). The component itself does NOT
 * stringify booleans — that happens one layer down in settingsApi.js, which is
 * mocked out here — so the save assertion expects a real boolean.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import CompanySettings from './CompanySettings'

vi.mock('../lib/settingsApi', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  // get stays forever-pending: useIndustries (useCachedLookup) chains .finally on
  // it at module scope — an undefined return would crash every render here.
  return { ...actual, default: { get: vi.fn(() => new Promise(() => {})), post: vi.fn(), put: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// BANNER-UPLOAD-1 (CMBE 23-07): the banner now uploads for real — multipart POST
// /settings/banner (field 'banner'), preview from the returned signed banner_url,
// and company_banner_url is backend-owned (never in the settings-save payload).
describe('CompanySettings — banner upload (BANNER-UPLOAD-1)', () => {
  it('uploads the picked file as multipart field "banner" and previews the returned signed URL', async () => {
    loadSettings.mockResolvedValue({})
    saveSettings.mockResolvedValue(undefined)
    api.post.mockResolvedValue({ data: { banner_url: 'https://api.test/files/tenant-banner/t1?sig=x' } })
    render(<CompanySettings />)

    await screen.findByRole('button', { name: t('common.upload') })
    const input = document.querySelector('input[type="file"]')
    const file = new File(['x'], 'banner.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/settings/banner', expect.any(FormData)))
    const fd = api.post.mock.calls[0][1]
    expect(fd.get('banner')).toBe(file)
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'https://api.test/files/tenant-banner/t1?sig=x'))
  })

  it('surfaces the backend 422 message (bad type / SVG script-scan) via notifyError', async () => {
    loadSettings.mockResolvedValue({})
    saveSettings.mockResolvedValue(undefined)
    api.post.mockRejectedValue({ response: { data: { message: 'SVG bevat scripts' } } })
    const { notifyError } = await import('@/lib/notify')
    render(<CompanySettings />)

    await screen.findByRole('button', { name: t('common.upload') })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['x'], 'x.svg', { type: 'image/svg+xml' })] } })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('SVG bevat scripts'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('never renders a legacy blob: URL and never sends company_banner_url in the save payload', async () => {
    loadSettings.mockResolvedValue({ company_banner_url: 'blob:http://localhost/legacy-broken' })
    saveSettings.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CompanySettings />)

    // A stale blob: row (pre-BANNER-UPLOAD-1 tenants) must not render as a banner;
    // the backend cleans it on the first real upload.
    await screen.findByRole('button', { name: t('common.upload') })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('common.save') }))
    await waitFor(() => expect(saveSettings).toHaveBeenCalled())
    expect(saveSettings.mock.calls[0][0].company_banner_url).toBeUndefined()
  })
})
