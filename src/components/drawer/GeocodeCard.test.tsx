/**
 * GeocodeCard — GEO-POLL-1: after a queued (202) re-geocode the card polls the record's
 * own GET route and shows the coordinates once the worker has written them, without a
 * reload; an inline answer shows at once; a card without a fetch route never polls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import GeocodeCard from './GeocodeCard'

const mockGet = vi.fn()
const mockPostGeocode = vi.fn()
// Keys, not copy: the assertions read the i18n keys the card resolves.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/components/ui/geocodeApi', () => ({ postGeocode: (...args: unknown[]) => mockPostGeocode(...args) }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: (...args: unknown[]) => mockGet(...args), post: vi.fn() },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const queued = { lat: null, lng: null, notFound: false }

describe('GeocodeCard', () => {
  it('shows the coordinates by itself once the queued write lands (no reload)', async () => {
    mockPostGeocode.mockResolvedValue(queued)
    mockGet.mockResolvedValueOnce({ data: { lat: null, lng: null } }).mockResolvedValue({ data: { lat: '52.09083', lng: '5.12222' } })
    render(<GeocodeCard lat={null} lng={null} endpoint="/customers/7/geocode" fetchEndpoint="/customers/7" permission="customers.update" />)
    expect(screen.getByText('backofficeLinks.geocode.notGeocoded')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'geocode.refresh' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockPostGeocode).toHaveBeenCalledWith('/customers/7/geocode')
    expect(mockGet).toHaveBeenCalledWith('/customers/7')
    expect(screen.getByText('backofficeLinks.geocode.linked')).toBeInTheDocument()
    expect(screen.getByText(/52\.09083/)).toBeInTheDocument()
  })

  it('adopts an inline answer at once and never polls without a fetch route', async () => {
    mockPostGeocode.mockResolvedValue({ lat: 51.9, lng: 4.5, notFound: false })
    render(<GeocodeCard lat={null} lng={null} endpoint="/customers/7/locations/2/geocode" permission="customers.update" />)
    fireEvent.click(screen.getByRole('button', { name: 'geocode.refresh' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(screen.getByText('backofficeLinks.geocode.linked')).toBeInTheDocument()
    mockPostGeocode.mockResolvedValue(queued)
    fireEvent.click(screen.getByRole('button', { name: 'geocode.refresh' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(mockGet).not.toHaveBeenCalled()
  })
})
