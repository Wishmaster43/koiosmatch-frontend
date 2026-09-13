/**
 * DriverLicenseSettings — LOOKUP-ICONS-FE-2 fix (13-09): driver_licenses gained an
 * icon column/fillable, but NOT color (DriverLicense::$fillable has no `color`) —
 * withColor stays false; only the icon mark + PATCH is guarded here.
 */
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import DriverLicenseSettings from './DriverLicenseSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

it('renders the icon-only mark (no colour column) and picking an icon PUTs {icon}', async () => {
  mockedApi.get.mockResolvedValue({ data: [{ id: 'dl1', name: 'B', icon: null }] })
  mockedApi.put.mockResolvedValue({ data: {} })
  const user = userEvent.setup()
  render(<DriverLicenseSettings />)

  await screen.findByText('B')
  const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'B' }) })
  await user.click(trigger)
  const iconCell = (await screen.findAllByRole('menuitem'))[0]
  await user.click(iconCell)

  await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/driver-licenses/dl1', expect.objectContaining({ icon: expect.any(String) })))
})
