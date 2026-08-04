/**
 * VacancySettings — the seniority + education lookups (DEFAULTS-1, V11/V19).
 *
 * Both mount the shared StatusListEditor WITH `defaultField`, so a tenant can flag
 * one row as the proposed default. The backend enforces the singleton
 * (HasSingletonFlag; is_default whitelisted in VacancySeniorityLevelController /
 * VacancyEducationLevelController), so the test asserts the REQUEST (§13) —
 * method + route + body — not merely that a click happened.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { VacancySenioritySettings, VacancyEducationSettings, VacancyStatusSettings, VacancyChannelSettings } from './VacancySettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
const row = (over = {}) => ({ id: 'r1', name: 'Medior', color: '#6FA8C4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('VacancySenioritySettings', () => {
  it('PUTs is_default:true to /vacancy-seniority-levels/{id} when a row is promoted', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'sen-1', name: 'Starter' }), row({ id: 'sen-2', name: 'Senior' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancySenioritySettings />)

    await screen.findByText('Starter')
    // Two rows → two "make default" pills; promoting the second must target ITS id.
    const pills = screen.getAllByRole('button', { name: st('common.setDefault') })
    expect(pills).toHaveLength(2)
    await user.click(pills[1])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-seniority-levels/sen-2',
      expect.objectContaining({ id: 'sen-2', is_default: true })))
  })

  it('shows the already-default row as a non-clickable default pill', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'sen-1', name: 'Starter', is_default: true })] })
    render(<VacancySenioritySettings />)

    const pill = await screen.findByRole('button', { name: st('common.default') })
    expect(pill).not.toBeDisabled() // DEFAULT-UNDO 04-08: active pill stays clickable (click = clear)
  })
})

describe('VacancyEducationSettings', () => {
  it('PUTs is_default:true to /vacancy-education-levels/{id} when a row is promoted', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'edu-1', name: 'MBO' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancyEducationSettings />)

    await screen.findByText('MBO')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-education-levels/edu-1',
      expect.objectContaining({ id: 'edu-1', is_default: true })))
  })
})

/**
 * VacancyStatusSettings — round-4 audit finding #1: is_open/is_closed (flagFields)
 * and is_default (defaultField) are all backend-writable (VacancyStatusController::
 * lookupExtraRules) but none was wired in the Settings screen. §13: assert the PUT
 * request body, not merely that a click happened.
 */
describe('VacancyStatusSettings', () => {
  // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
  const status = (over = {}) => ({ id: 'st1', name: 'Open', color: '#79B58E', is_open: false, is_closed: false, is_default: false, ...over })

  it('PUTs is_open:true to /vacancy-statuses/{id} when the flag is toggled in the edit modal', async () => {
    api.get.mockResolvedValue({ data: [status()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancyStatusSettings />)

    await screen.findByText('Open')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    // Two independent flagFields toggles in modal order: is_open first, is_closed second.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-statuses/st1',
      expect.objectContaining({ is_open: true, is_closed: false })))
  })

  it('PUTs is_default:true to /vacancy-statuses/{id} when a row is promoted', async () => {
    api.get.mockResolvedValue({ data: [status({ id: 'st2', name: 'Concept' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancyStatusSettings />)

    await screen.findByText('Concept')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-statuses/st2',
      expect.objectContaining({ is_default: true })))
  })
})

/**
 * VacancyChannelSettings — round-4 audit finding #2: withColor was hardcoded off
 * even though vacancy_channels carries a `color` column, and active/default_enabled
 * (VacancyChannelController::lookupExtraRules) had no editor. §13: assert the PUT
 * request body, not merely that a click happened.
 */
describe('VacancyChannelSettings', () => {
  // eslint-disable-next-line no-restricted-syntax -- DATA: a fixture row's tenant-picked colour, not a style rule.
  const channel = (over = {}) => ({ id: 'ch1', name: 'Indeed', color: '#6E8FD6', icon: 'globe', active: true, default_enabled: true, ...over })

  it('renders the colour badge and the curated icon picker (the migration carries both)', async () => {
    api.get.mockResolvedValue({ data: [channel()] })
    render(<VacancyChannelSettings />)

    // ColorBadge (withColor) has a distinctive pill shape the plain withColor=false span never had.
    const badge = await screen.findByText('Indeed')
    expect(badge).toHaveStyle({ borderRadius: '999px' })
    expect(screen.getByRole('button', { name: `${st('documentTypes.icon')}: Indeed` })).toBeInTheDocument()
  })

  it('PUTs active:false to /vacancy-channels/{id} when the flag is toggled off in the edit modal', async () => {
    api.get.mockResolvedValue({ data: [channel()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancyChannelSettings />)

    await screen.findByText('Indeed')
    await user.click(screen.getByRole('button', { name: st('statusList.edit') }))
    // Two independent flagFields toggles in modal order: active first, default_enabled second — both start ON.
    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])
    await user.click(screen.getByText(st('common.save')))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vacancy-channels/ch1',
      expect.objectContaining({ active: false, default_enabled: true })))
  })
})
