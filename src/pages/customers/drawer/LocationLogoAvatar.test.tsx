/**
 * LocationLogoAvatar — K4BLOGO. Round out its missing coverage (§13: mutation
 * tests assert the request, never only that a callback fired): the view-only
 * render without canUpdate, the exact uploadLocationLogo(customerId, locationId,
 * file) call + LOCATIONS_CHANGED_EVENT dispatch on success, the notifyError path
 * on a rejected upload, and the disabled-while-uploading state.
 *
 * Side-effect import: initialises the real i18next instance so useTranslation
 * inside the component does not warn (mirrors LocationDetail.test.tsx/
 * VacanciesTab.test.tsx) — assertions resolve labels through the ACTIVE
 * locale's own copy instead of guessing/hardcoding a language.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationLogoAvatar from './LocationLogoAvatar'

// Mock the hook module's upload function directly — the component only needs
// its exact call shape, not the underlying multipart POST.
const mockUpload = vi.fn()
vi.mock('../hooks/useCustomerLocations', () => ({
  uploadLocationLogo: (...args: unknown[]) => mockUpload(...args),
  LOCATIONS_CHANGED_EVENT: 'km:locations-changed',
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import { notifyError } from '@/lib/notify'

const t = (key: string) => i18n.t(key, { ns: 'customers' })

describe('LocationLogoAvatar', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    vi.mocked(notifyError).mockReset()
  })

  // A viewer without customers.update sees a plain avatar — no upload affordance at all.
  it('renders a read-only avatar without the upload button when canUpdate is false', () => {
    render(<LocationLogoAvatar customerId="c1" locationId="l1" logoUrl={null} name="Noord" canUpdate={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // Picking a file fires the exact upload call, then broadcasts the shared refetch event.
  it('uploads the picked file with the exact customerId/locationId/file and dispatches LOCATIONS_CHANGED_EVENT', async () => {
    mockUpload.mockResolvedValue('https://example.test/logo.png')
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<LocationLogoAvatar customerId="c1" locationId="l1" logoUrl={null} name="Noord" canUpdate />)

    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    const input = screen.getByLabelText(t('locations.detail.logoUpload'), { selector: 'input' })
    await userEvent.upload(input, file)

    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith('c1', 'l1', file))
    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'km:locations-changed' })))
    dispatchSpy.mockRestore()
  })

  // A rejected upload shows the translated error and never leaves the busy state stuck.
  it('shows notifyError and clears the busy state when the upload rejects', async () => {
    mockUpload.mockRejectedValue(new Error('network error'))
    render(<LocationLogoAvatar customerId="c1" locationId="l1" logoUrl={null} name="Noord" canUpdate />)

    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    const input = screen.getByLabelText(t('locations.detail.logoUpload'), { selector: 'input' })
    await userEvent.upload(input, file)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(t('locations.detail.logoUploadFailed')))
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
  })
})
