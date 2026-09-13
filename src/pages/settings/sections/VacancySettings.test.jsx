/**
 * VacancySettings — the seniority + education lookups (DEFAULTS-1, V11/V19).
 *
 * Both mount the shared StatusListEditor WITH `defaultField`, so a tenant can flag
 * one row as the proposed default. The backend enforces the singleton
 * (HasSingletonFlag; is_default whitelisted in VacancySeniorityLevelController /
 * VacancyEducationLevelController), so the test asserts the REQUEST (§13) —
 * method + route + body — not merely that a click happened.
 * Also: X-20 regression guard for the flag defaults: VacancyChannelSettings'
 * `active` flag gets `default: true` so new channels start active.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { VacancySenioritySettings, VacancyEducationSettings, VacancyStatusSettings, VacancyPhaseSettings, VacancyChannelSettings } from './VacancySettings'

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

  // LOOKUP-ICONS-FE-2 fix (13-09): vacancy_seniority_levels has no icon column/
  // validation — the mark stays colour-only.
  it('the value mark stays colour-only', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'sen-1', name: 'Starter' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<VacancySenioritySettings />)

    await screen.findByText('Starter')
    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Starter' }) })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Starter' }) })).toBeInTheDocument()
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

  it('renders a plain label and the curated icon+colour mark (the migration carries both)', async () => {
    api.get.mockResolvedValue({ data: [channel()] })
    render(<VacancyChannelSettings />)

    // LOOKUP-ONE-ELEMENT-1: the colour now lives on the LookupValueMark trigger —
    // the row's own label is plain text, never the old ColorBadge pill (99px radius).
    const label = await screen.findByText('Indeed')
    expect(label).not.toHaveStyle({ borderRadius: '99px' })
    expect(screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Indeed' }) })).toBeInTheDocument()
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

  it('create POST to /vacancy-channels carries active:true (X-20: flag default)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: channel({ id: 'ch9', name: 'LinkedIn', active: true, default_enabled: false }) })
    const user = userEvent.setup()
    render(<VacancyChannelSettings />)

    await user.click(await screen.findByRole('button', { name: st('vacancy.channelsAdd') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'LinkedIn')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancy-channels',
      expect.objectContaining({ name: 'LinkedIn', active: true })))
  })
})

// LOOKUP-ICONS-FE-2 (Danny 13-09 15:25, "de opties onder dat kopje"): vacancy statuses and
// phases carry icon + colour (VacancyStatusController / VacancyPhaseController validate
// `icon`), so the row wears the icon-and-colour mark and an icon pick PUTs {icon}.
describe('vacancy statuses and phases — icon-and-colour mark (LOOKUP-ICONS-FE-2)', () => {
  const cases = [
    { name: 'VacancyStatusSettings', Comp: VacancyStatusSettings, endpoint: '/vacancy-statuses', label: 'Open' },
    { name: 'VacancyPhaseSettings', Comp: VacancyPhaseSettings, endpoint: '/vacancy-phases', label: 'Werving' },
  ]
  for (const c of cases) {
    it(`${c.name}: the row wears the icon-and-colour mark and picking an icon PUTs {icon} on ${c.endpoint}/{id}`, async () => {
      api.get.mockResolvedValue({ data: [row({ id: 'r1', name: c.label, icon: 'globe' })] })
      api.put.mockResolvedValue({ data: {} })
      render(<c.Comp />)
      await screen.findByText(c.label)
      const mark = screen.getByRole('button', { name: st('statusList.valueMark', { label: c.label }) })
      fireEvent.click(mark)
      const iconOption = await screen.findByRole('menuitem', { name: `${st('documentTypes.icon')}: tag` })
      fireEvent.click(iconOption)
      await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${c.endpoint}/r1`, expect.objectContaining({ icon: 'tag' })))
    })
  }
})
