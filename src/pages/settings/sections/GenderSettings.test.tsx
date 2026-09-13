/**
 * GenderSettings — §13 regression guard for the withValueSlug opt-in
 * (AF:lookups-1): CandidateGenderController validates `value` on create —
 * without the opt-in the "+ toevoegen" button 422'd.
 */
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import GenderSettings from './GenderSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

it('GenderSettings: create POST to /genders carries the slugged value', async () => {
  mockedApi.get.mockResolvedValue({ data: [] })
  mockedApi.post.mockResolvedValue({ data: { id: 'x1', label: 'Male' } })
  const user = userEvent.setup()
  render(<GenderSettings />)

  await user.click(await screen.findByRole('button', { name: st('genderSettings.add') }))
  await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Male')
  await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

  await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/genders',
    expect.objectContaining({ name: 'Male', value: 'male' })))
})

// LOOKUP-ICONS-FE-2 fix (13-09): candidate_genders has no icon column — the mark
// stays colour-only ('dialog', not 'menu').
it('GenderSettings: row renders the colour-only mark', async () => {
  mockedApi.get.mockResolvedValue({ data: [{ id: 'g1', name: 'Male', value: 'male', color: 'var(--color-primary)' }] })
  mockedApi.put.mockResolvedValue({ data: {} })
  const user = userEvent.setup()
  render(<GenderSettings />)

  await screen.findByText('Male')
  const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Male' }) })
  expect(trigger).toBeTruthy()

  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Male' }) })).toBeInTheDocument()
})
