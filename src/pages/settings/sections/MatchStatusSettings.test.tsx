/**
 * MatchStatusSettings + MatchStopReasonSettings — §13 regression guards for the
 * withValueSlug opt-in (LOOKUP-GAP-1(d) verification 08-08): both controllers
 * extend SlugLookupController, whose store() REQUIRES `value` — without the
 * opt-in every "+ toevoegen" 422'd silently while the unit tests stayed green.
 * Mirrors ContractTypesSettings.test.jsx (same shared editor, same contract).
 */
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import { MatchStatusSettings, MatchStopReasonSettings } from './MatchSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// One fixture row per export under test — component, endpoint and the typed/slugged pair to assert.
interface CreateAssert {
  name: string
  Comp: () => ReactElement
  endpoint: string
  addKey: string
  typed: string
  slug: string
}

// One create-flow per export: type a name, submit, assert the POST body carries
// the slugged `value` the SlugLookupController base requires.
const createAsserts: CreateAssert[] = [
  { name: 'MatchStatusSettings', Comp: MatchStatusSettings, endpoint: '/match-statuses', addKey: 'matches.statusAdd', typed: 'On hold', slug: 'on_hold' },
  { name: 'MatchStopReasonSettings', Comp: MatchStopReasonSettings, endpoint: '/match-stop-reasons', addKey: 'matches.stopReasonAdd', typed: 'Einde contract', slug: 'einde_contract' },
]

describe.each(createAsserts)('$name · withValueSlug (§13)', ({ Comp, endpoint, addKey, typed, slug }: CreateAssert) => {
  it(`create POST to ${endpoint} carries the slugged value`, async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'x1', name: typed } })
    const user = userEvent.setup()
    render(<Comp />)

    await user.click(await screen.findByRole('button', { name: st(addKey) }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), typed)
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(endpoint,
      expect.objectContaining({ name: typed, value: slug })))
  })
})

describe.each(createAsserts)('$name · icon-and-colour mark (LOOKUP-ICONEN-1)', ({ Comp }: CreateAssert) => {
  it('the value mark carries icon and colour (LOOKUP-ICONEN-1)', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'ms1', name: 'Actief', color: 'var(--color-primary)' }] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<Comp />)

    await screen.findByText('Actief')
    const trigger = screen.getByRole('button', { name: st('statusList.valueMark', { label: 'Actief' }) })
    await user.click(trigger)
    expect(screen.getByRole('menu', { name: st('statusList.valueMark', { label: 'Actief' }) })).toBeInTheDocument()
  })
})
