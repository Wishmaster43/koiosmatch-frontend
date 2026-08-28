/**
 * CompanySettings — "Career site active" opt-in toggle (§13: assert the REQUEST
 * payload, never only that a callback fired). The component itself does NOT
 * stringify booleans — that happens one layer down in settingsApi.js, which is
 * mocked out here — so the save assertion expects a real boolean.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { getCountryName } from '@/lib/countries'
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

// COMPANY-ORDER-1 (Danny 09-08: "#settings/company/company — volgorde klopt niet").
// Country used to sit at the top, split off from the address block it CLOSES.
// The screen now reads in three blocks — identity · address (in writing order) ·
// preferences — and the country↔province cascade must survive country moving to
// the BOTTOM of the address block (it drives a field rendered ABOVE it).
const rowOf = (label) => screen.getByText(label).parentElement
const precedes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

// TAAL-NAAM-1 (Danny 25-08: "bij Taal moet Nederlands staan en niet nl"): the
// setting stores the locale CODE; the field always shows the language NAME, and
// a legacy row that stored the name normalizes to the code (never a raw 'nl').
describe('CompanySettings — language shows its name, stores its code (TAAL-NAAM-1)', () => {
  it('renders "Nederlands" for a stored code and never the raw code', async () => {
    loadSettings.mockResolvedValue({ company_language: 'nl' })
    saveSettings.mockResolvedValue(undefined)
    render(<CompanySettings />)
    expect(await screen.findByText('Nederlands')).toBeInTheDocument()
    expect(screen.queryByText(/^nl$/)).not.toBeInTheDocument()
  })

  it('normalizes a legacy stored NAME to its code and still renders the name', async () => {
    loadSettings.mockResolvedValue({ company_language: 'Deutsch' })
    saveSettings.mockResolvedValue(undefined)
    render(<CompanySettings />)
    expect(await screen.findByText('Deutsch')).toBeInTheDocument()
  })
})

describe('CompanySettings — field order & grouping (COMPANY-ORDER-1)', () => {
  it('renders identity → address (street…country) → preferences, each under its own heading', async () => {
    loadSettings.mockResolvedValue({})
    render(<CompanySettings />)
    await screen.findByRole('button', { name: t('common.upload') })

    // The full reading order, asserted pairwise on the rendered label nodes.
    const order = [
      t('company.sectionIdentity'), t('company.banner'), t('company.industry'),
      t('company.sectionAddress'), t('company.street'), t('company.houseNumber'),
      t('company.postcode'), t('company.city'), t('company.province'), t('company.country'),
      t('company.sectionPreferences'), t('company.language'), t('company.currency'), t('company.timezone'),
    ]
    const nodes = order.map(label => screen.getByText(label))
    nodes.forEach((node, i) => {
      if (i === 0) return
      expect(precedes(nodes[i - 1], node), `${order[i - 1]} must precede ${order[i]}`).toBe(true)
    })
  })
})

// The cascade itself (PROVINCES-1): GET /provinces?country=XX drives the province
// options. Measured live 2026-08-09 — NL returns 12 rows, BE returns 11 different
// ones — so a broken cascade is visible as "the wrong country's provinces".
describe('CompanySettings — province cascade after the country move (COMPANY-ORDER-1)', () => {
  const provincesByCountry = {
    NL: ['Utrecht', 'Zuid-Holland'],
    BE: ['Antwerpen', 'Limburg'],
  }

  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url === '/countries')  return Promise.resolve({ data: { data: [{ code: 'NL' }, { code: 'BE' }] } })
      if (url === '/industries') return Promise.resolve({ data: { data: ['Zorg'] } })
      const province = /^\/provinces\?country=([A-Z]{2})&active=1$/.exec(url)
      if (province) return Promise.resolve({ data: { data: provincesByCountry[province[1]] ?? [] } })
      return new Promise(() => {})
    })
  })

  // Restore the file-level "forever pending" GET so later suites are unaffected.
  afterEach(() => { api.get.mockImplementation(() => new Promise(() => {})) })

  it('switching the country (now the LAST address row) refreshes the province options above it', async () => {
    // Empty province on purpose: the trigger then carries no accessible name, so a
    // province NAME in the tree can only be a menu option.
    loadSettings.mockResolvedValue({ company_country: 'NL', company_province: '' })
    const user = userEvent.setup()
    render(<CompanySettings />)
    await screen.findByRole('button', { name: t('common.upload') })

    // The province picker (searchable dropdown, never a native select) starts on NL.
    const provinceTrigger = within(rowOf(t('company.province'))).getByRole('button')
    await user.click(provinceTrigger)
    expect(await screen.findByRole('button', { name: 'Utrecht' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Antwerpen' })).not.toBeInTheDocument()
    await user.click(provinceTrigger)

    // Pick Belgium in the country row that now sits BELOW the province row.
    const countryTrigger = within(rowOf(t('company.country'))).getByRole('button')
    await user.click(countryTrigger)
    await user.click(await screen.findByRole('button', { name: getCountryName('BE', i18n.language) }))

    // Cascade proof: the province list is Belgium's now, not the stale NL one.
    await user.click(provinceTrigger)
    expect(await screen.findByRole('button', { name: 'Antwerpen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utrecht' })).not.toBeInTheDocument()
  })
})
