/**
 * BlacklistReasonsSettings — ONE entity per registration ("klant bij klant,
 * kandidaat bij kandidaat", Danny 2026-08-05): the entity prop picks the endpoint.
 * Asserts each entity hits its OWN route (the key regression risk of one component
 * serving two endpoints) and the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import BlacklistReasonsSettings from './BlacklistReasonsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// BLACKLIST-TOGGLE-1: controllable settings blob + a spy on the save path
// (§13: assert the REQUEST), same pattern as CandidateConversionSettings.test.
const mockSettings = vi.fn(() => ({}))
const saveSettingsKeys = vi.fn(async (...args: unknown[]) => { void args })
// SETTINGS-LOAD-ERROR-1: load-state is stubbed 'loaded' by default so the
// existing tests below are unaffected; the dedicated describe block flips it
// to 'failed' to prove the shared SettingsLoadBanner renders + retries.
const loadStateRef = vi.hoisted(() => ({ current: 'loaded' }))
const retryMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return {
    ...actual,
    useSettingsLoaded: () => true,
    useAllSettings: () => mockSettings(),
    useSettingsLoadState: () => ({ state: loadStateRef.current, retry: retryMock }),
    saveSettingsKeys: (...args: unknown[]) => saveSettingsKeys(...args),
    invalidateAllSettingsCache: vi.fn(),
  }
})

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over: Record<string, unknown> = {}) => ({ id: 'b1', name: 'No-show', color: '#D98A8A', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('BlacklistReasonsSettings', () => {
  it('the candidate registration (default) GETs /candidate-blacklist-reasons', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(mockedApi.get).toHaveBeenCalledWith('/candidate-blacklist-reasons', undefined)
  })

  it('the customer registration GETs /customer-blacklist-reasons', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    render(<BlacklistReasonsSettings entity="customer" />)

    await screen.findByText('No-show')
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/customer-blacklist-reasons', undefined))
  })

  it('creating a candidate blacklist reason POSTs to /candidate-blacklist-reasons', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockedApi.post.mockResolvedValue({ data: row({ id: 'b2', name: 'Agressie' }) })
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    await user.click(screen.getByRole('button', { name: st('blacklistReasons.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Agressie')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/candidate-blacklist-reasons', expect.objectContaining({ name: 'Agressie' })))
  })

  // Both blacklist controllers gained sort_order + PUT /{endpoint}/reorder on
  // 2026-08-04 (BE b649f8f0) — this guards the removal of the stale
  // reorderable={false} opt-out (LOOKUP-GAP-1(d) verification 08-08).
  it('drag-reorder is enabled and persists via PUT /candidate-blacklist-reasons/reorder', async () => {
    mockedApi.get.mockResolvedValue({ data: [row({ id: 'b1', name: 'No-show' }), row({ id: 'b2', name: 'Agressie' })] })
    mockedApi.put.mockResolvedValue({ data: {} })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('Agressie')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Agressie')!)
    fireEvent.dragOver(rowOf('No-show')!)
    fireEvent.drop(rowOf('No-show')!)

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/candidate-blacklist-reasons/reorder', { ids: ['b2', 'b1'] }))
  })
})

// BLACKLIST-TOGGLE-1: the tenant switch above the lookup — reads the ON state
// from the settings blob and writes the EXACT per-entity key on toggle.
describe('BlacklistReasonsSettings · reason-required toggle', () => {
  it('renders ON for the candidate registration when blacklist_reason_required is \'1\'', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ blacklist_reason_required: '1' })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(screen.getByRole('switch', { name: st('blacklistReasons.requiredToggle.label') })).toHaveAttribute('aria-checked', 'true')
  })

  it('renders OFF for the candidate registration when blacklist_reason_required is \'0\'', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ blacklist_reason_required: '0' })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(screen.getByRole('switch', { name: st('blacklistReasons.requiredToggle.label') })).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the toggle for the candidate registration saves blacklist_reason_required', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ blacklist_reason_required: '1' })
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    await user.click(screen.getByRole('switch', { name: st('blacklistReasons.requiredToggle.label') }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ blacklist_reason_required: false }))
  })

  it('clicking the toggle for the customer registration saves customer_blacklist_reason_required', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({ customer_blacklist_reason_required: '1' })
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings entity="customer" />)

    await screen.findByText('No-show')
    await user.click(screen.getByRole('switch', { name: st('blacklistReasons.requiredToggle.label') }))

    await waitFor(() => expect(saveSettingsKeys).toHaveBeenCalledWith({ customer_blacklist_reason_required: false }))
  })
})

// SETTINGS-LOAD-ERROR-1: screen-level proof that a failed GET /settings surfaces the
// shared SettingsLoadBanner with a working retry, instead of leaving the toggle
// silently disabled forever with no visible error.
describe('BlacklistReasonsSettings — failed settings load', () => {
  it('shows the load-error banner and retries on click', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockSettings.mockReturnValue({})
    loadStateRef.current = 'failed'
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(screen.getByRole('alert')).toHaveTextContent(st('common.loadError'))

    await user.click(screen.getByRole('button', { name: i18n.t('error.retry', { ns: 'common' }) }))
    expect(retryMock).toHaveBeenCalledTimes(1)

    loadStateRef.current = 'loaded'
  })
})
