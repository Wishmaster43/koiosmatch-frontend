/**
 * AppsSettings — APPS-HF-SLUG-1 regression (Danny 23-07): toggling HelloFlex must
 * send the backend's 'hf' slug (VALID_APPS), and a failed PUT must surface an
 * error instead of the old silent noop. §13: assert the REQUEST, not a callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AppsSettings from './AppsSettings'

const mockPut = vi.fn()
vi.mock('@/lib/api', () => ({ default: { put: (...a) => mockPut(...a) } }))
const mockNotifyError = vi.fn()
vi.mock('@/lib/notify', () => ({ notifyError: (...a) => mockNotifyError(...a) }))
vi.mock('@/lib/extractApiError', () => ({ extractApiError: (err, fb) => err?.response?.data?.message ?? fb }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true, hasModule: () => true, isSuperAdmin: () => true }) }))
vi.mock('@/lib/access', () => ({ canAccessPage: () => true }))

// Real AVAILABLE_APPS ride along; only the enabled-state hook is stubbed.
const mockSetApps = vi.fn()
vi.mock('@/context/AppsContext', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useApps: () => ({ enabled: [], setApps: mockSetApps, isAppEnabled: () => false }) }
})

beforeEach(() => { mockPut.mockReset(); mockNotifyError.mockReset(); mockSetApps.mockReset() })

describe('AppsSettings', () => {
  it("enabling HelloFlex PUTs the backend 'hf' slug, never 'helloflex'", async () => {
    mockPut.mockResolvedValue({})
    render(<AppsSettings />)
    // APPS-GROUPS-1: HelloFlex lives under the Backoffice subtab — open it first.
    fireEvent.click(screen.getByRole('button', { name: 'apps.tabBackoffice' }))
    // Click every ENABLED toggle on this tab (coming-soon toggles are disabled by
    // design): at least one PUT carries 'hf' and none ever carries 'helloflex'.
    for (const b of screen.getAllByTitle('apps.enable')) fireEvent.click(b)
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    const bodies = mockPut.mock.calls.map(([url, body]) => ({ url, body }))
    expect(bodies.every(({ url }) => url === '/settings/apps')).toBe(true)
    expect(bodies.some(({ body }) => body.enabled.includes('hf'))).toBe(true)
    expect(bodies.every(({ body }) => !body.enabled.includes('helloflex'))).toBe(true)
  })

  it('surfaces the server message on a failed toggle instead of silently swallowing it', async () => {
    mockPut.mockRejectedValue({ response: { data: { message: 'Ongeldige app(s): x' } } })
    render(<AppsSettings />)
    // The first buttons are the subtab bar — click the first real TOGGLE instead.
    fireEvent.click(screen.getAllByTitle('apps.enable')[0])
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Ongeldige app(s): x'))
    expect(mockSetApps).not.toHaveBeenCalled()
  })
})
