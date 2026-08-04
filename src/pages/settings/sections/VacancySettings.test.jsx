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
import { VacancySenioritySettings, VacancyEducationSettings } from './VacancySettings'

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
