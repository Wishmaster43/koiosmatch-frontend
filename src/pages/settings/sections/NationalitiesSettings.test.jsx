/**
 * NationalitiesSettings — thin StatusListEditor wrapper against /nationalities
 * (LOOKUP-GAP-1). Asserts the create REQUEST (§13): method/route/body, not just
 * that the button click "did something".
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import NationalitiesSettings from './NationalitiesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'n1', name: 'Nederlandse', color: '#3B8FD4', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('NationalitiesSettings', () => {
  it('loads the list from /nationalities', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(api.get).toHaveBeenCalledWith('/nationalities', undefined)
  })

  it('creating a nationality POSTs name to /nationalities', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'n2', name: 'Belgische' }) })
    const user = userEvent.setup()
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    await user.click(screen.getByRole('button', { name: st('nationalities.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Belgische')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/nationalities', expect.objectContaining({ name: 'Belgische' })))
  })

  // NATION-FLAG-1: the row's flag is the ONE adornment (colour stays off) —
  // derived from the ISO-2 country_code, never a second stored value.
  it('renders the flag emoji before the name when the row carries a country_code', async () => {
    api.get.mockResolvedValue({ data: [row({ country_code: 'NL' })] })
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(screen.getByText('🇳🇱')).toBeInTheDocument()
  })

  it('renders no flag when the row has no country_code yet', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(screen.queryByText('🇳🇱')).not.toBeInTheDocument()
  })

  // NATION-FLAG-1: picking a country in the create modal sends its ISO-2 code —
  // asserts the actual REQUEST body (§13), not just that the picker "did something".
  it('picking a country in the create modal sends its ISO-2 code as country_code', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'n3', name: 'Duitse', country_code: 'DE' }) })
    const user = userEvent.setup()
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    await user.click(screen.getByRole('button', { name: st('nationalities.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Duitse')
    await user.click(screen.getByRole('button', { name: st('nationalities.countryCode') }))
    await user.click(await screen.findByText('Duitsland'))
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/nationalities', expect.objectContaining({ name: 'Duitse', country_code: 'DE' })))
  })
})
