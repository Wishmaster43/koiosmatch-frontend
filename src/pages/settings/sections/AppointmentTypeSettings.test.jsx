/**
 * AppointmentTypeSettings (APPT-1) — §13 regression guard for the withValueSlug
 * opt-in (AF:lookups-1): AppointmentTypeController extends SlugLookupController,
 * whose store() REQUIRES `value` — without the opt-in the "+ toevoegen" button 422'd.
 */
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { AppointmentTypeSettings } from './AppointmentTypeSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

it('AppointmentTypeSettings: create POST to /appointment-types carries the slugged value', async () => {
  api.get.mockResolvedValue({ data: [] })
  api.post.mockResolvedValue({ data: { id: 'x1', name: 'Intake gesprek' } })
  const user = userEvent.setup()
  render(<AppointmentTypeSettings />)

  await user.click(await screen.findByRole('button', { name: st('appointmentTypes.add') }))
  await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Intake gesprek')
  await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/appointment-types',
    expect.objectContaining({ name: 'Intake gesprek', value: 'intake_gesprek' })))
})
