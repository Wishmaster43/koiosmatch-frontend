/**
 * NationalitiesSettings — thin StatusListEditor wrapper against /nationalities
 * (LOOKUP-GAP-1). Asserts the create REQUEST (§13): method/route/body, not just
 * that the button click "did something".
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import NationalitiesSettings from './NationalitiesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// I18N-1 work-permit toggle: controllable settings blob + a spy on the save path
// (§13: assert the REQUEST), same pattern as BlacklistReasonsSettings.test.
const mockSettings = vi.fn(() => ({}))
const saveSettingsKeys = vi.fn(async () => {})
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useSettingsLoaded: () => true,
    useAllSettings: () => mockSettings(),
    saveSettingsKeys: (...args: Parameters<typeof saveSettingsKeys>) => saveSettingsKeys(...args),
    invalidateAllSettingsCache: vi.fn(),
  }
})

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// A fixture nationality row, overridable per test.
interface RowFixture { id: string; name: string; color: string; in_use: boolean; country_code?: string }
// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over: Partial<RowFixture> = {}): RowFixture => ({ id: 'n1', name: 'Nederlandse', color: '#3B8FD4', in_use: false, ...over })

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

  // REASON-REORDER-1 (backend landed 04-08): NationalityController gained
  // PUT /nationalities/reorder that day — the editor no longer opts out of it
  // (LOOKUP-GAP-1(d) verification 08-08 caught the stale reorderable={false}).
  it('drag-reorder is enabled and persists via PUT /nationalities/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'n1', name: 'Nederlandse' }), row({ id: 'n2', name: 'Belgische' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<NationalitiesSettings />)

    await screen.findByText('Belgische')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]') as HTMLElement
    fireEvent.dragStart(rowOf('Belgische'))
    fireEvent.dragOver(rowOf('Nederlandse'))
    fireEvent.drop(rowOf('Nederlandse'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/nationalities/reorder', { ids: ['n2', 'n1'] }))
  })
})

// I18N-1: the tenant's EU/EEA work-permit override lives on this screen (it overrides
// the is_eu flag below it) — asserts the rendered state AND the saved key (§13).
describe('NationalitiesSettings · work-permit toggle (I18N-1)', () => {
  it('renders ON when work_permit_required_for_eu_nationals is \'1\'', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ work_permit_required_for_eu_nationals: '1' })
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(screen.getByRole('switch', { name: st('nationalities.workPermitToggle.label') })).toHaveAttribute('aria-checked', 'true')
  })

  it('renders OFF when the setting is \'0\' or absent', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({})
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(screen.getByRole('switch', { name: st('nationalities.workPermitToggle.label') })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the toggle saves work_permit_required_for_eu_nationals: true', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ work_permit_required_for_eu_nationals: '0' })
    const user = userEvent.setup()
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    await user.click(screen.getByRole('switch', { name: st('nationalities.workPermitToggle.label') }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ work_permit_required_for_eu_nationals: true }))
  })
})
