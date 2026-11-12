/**
 * EmbedOriginsCard — CAREER-EMBED-FE-1. §13: save assertions check the REQUEST
 * (settings POST route + exact wire body), and a refused value sends no request.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import EmbedOriginsCard from './EmbedOriginsCard'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const postMock = vi.hoisted(() => vi.fn<(url: string, body: unknown) => Promise<unknown>>(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
const invalidateMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/settings/useAllSettings')
  return { ...actual, invalidateAllSettingsCache: invalidateMock }
})
const notifyErrorMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError: notifyErrorMock }))

afterEach(() => { vi.clearAllMocks() })

const addButton = () => screen.getByRole('button', { name: t('careerSite.embedOrigins.addAction') })
const input = () => screen.getByLabelText(t('careerSite.embedOrigins.add'))

describe('EmbedOriginsCard', () => {
  it('renders rows from a stored JSON string', () => {
    render(<EmbedOriginsCard stored='["https://a.nl","https://b.nl"]' />)
    expect(screen.getByText('https://a.nl')).toBeInTheDocument()
    expect(screen.getByText('https://b.nl')).toBeInTheDocument()
  })

  it('renders rows from a stored real array', () => {
    render(<EmbedOriginsCard stored={['https://a.nl']} />)
    expect(screen.getByText('https://a.nl')).toBeInTheDocument()
  })

  it('associates the add label with the input and renders origins at the 13 px body size', () => {
    render(<EmbedOriginsCard stored={['https://a.nl']} />)
    expect(screen.getByLabelText(t('careerSite.embedOrigins.add'))).toHaveAttribute('type', 'url')
    expect(screen.getByText('https://a.nl').parentElement).toHaveStyle({ fontSize: '13px' })
  })

  it('shows the empty line when nothing is stored', () => {
    render(<EmbedOriginsCard stored={undefined} />)
    expect(screen.getByText(t('careerSite.embedOrigins.empty'))).toBeInTheDocument()
  })

  it('adding a normalized origin POSTs the longer list as a wire string', async () => {
    const user = userEvent.setup()
    render(<EmbedOriginsCard stored='["https://existing.nl"]' />)
    await user.type(input(), 'https://www.voorbeeld.nl/')
    await user.click(addButton())
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith('/settings', {
      career_site_embed_origins: '["https://existing.nl","https://www.voorbeeld.nl"]',
    })
  })

  it('Enter in the input adds as well', async () => {
    const user = userEvent.setup()
    render(<EmbedOriginsCard stored={[]} />)
    await user.type(input(), 'https://a.nl{Enter}')
    expect(postMock).toHaveBeenCalledWith('/settings', { career_site_embed_origins: '["https://a.nl"]' })
  })

  it.each([
    ['http://a.nl', 'notHttps'],
    ['https://existing.nl', 'duplicate'],
    ['https://a.nl/x', 'hasPath'],
    ['https://*.a.nl', 'invalid'],
  ])('refuses %s with the %s message and sends no request', async (value, key) => {
    const user = userEvent.setup()
    render(<EmbedOriginsCard stored='["https://existing.nl"]' />)
    await user.type(input(), value)
    await user.click(addButton())
    expect(screen.getByRole('alert')).toHaveTextContent(t(`careerSite.embedOrigins.errors.${key}`, { max: 10 }))
    expect(postMock).not.toHaveBeenCalled()
  })

  it('removing POSTs the shorter list, and [] when the last one goes', async () => {
    const user = userEvent.setup()
    render(<EmbedOriginsCard stored='["https://a.nl","https://b.nl"]' />)
    await user.click(screen.getByRole('button', { name: t('careerSite.embedOrigins.remove', { origin: 'https://a.nl' }) }))
    expect(postMock).toHaveBeenLastCalledWith('/settings', { career_site_embed_origins: '["https://b.nl"]' })
    await user.click(screen.getByRole('button', { name: t('careerSite.embedOrigins.remove', { origin: 'https://b.nl' }) }))
    expect(postMock).toHaveBeenLastCalledWith('/settings', { career_site_embed_origins: '[]' })
  })

  it('disables the input and the add button at the maximum', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `https://s${i}.nl`)
    render(<EmbedOriginsCard stored={ten} />)
    expect(input()).toBeDisabled()
    expect(addButton()).toBeDisabled()
  })

  it('reports a rejected save, refetches and shows the stored list again', async () => {
    postMock.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<EmbedOriginsCard stored={['https://a.nl']} />)
    await user.click(screen.getByRole('button', { name: t('careerSite.embedOrigins.remove', { origin: 'https://a.nl' }) }))
    await vi.waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith(t('careerSite.saveError')))
    expect(invalidateMock).toHaveBeenCalled()
    expect(await screen.findByText('https://a.nl')).toBeInTheDocument()
  })
})
