/**
 * MatchStatusSettings + MatchStopReasonSettings — §13 regression guards for the
 * withValueSlug opt-in (LOOKUP-GAP-1(d) verification 08-08): both controllers
 * extend SlugLookupController, whose store() REQUIRES `value` — without the
 * opt-in every "+ toevoegen" 422'd silently while the unit tests stayed green.
 * Mirrors ContractTypesSettings.test.jsx (same shared editor, same contract).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { MatchStatusSettings, MatchStopReasonSettings } from './MatchSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// One create-flow per export: type a name, submit, assert the POST body carries
// the slugged `value` the SlugLookupController base requires.
const createAsserts = [
  { name: 'MatchStatusSettings', Comp: MatchStatusSettings, endpoint: '/match-statuses', addKey: 'matches.statusAdd', typed: 'On hold', slug: 'on_hold' },
  { name: 'MatchStopReasonSettings', Comp: MatchStopReasonSettings, endpoint: '/match-stop-reasons', addKey: 'matches.stopReasonAdd', typed: 'Einde contract', slug: 'einde_contract' },
]

describe.each(createAsserts)('$name · withValueSlug (§13)', ({ Comp, endpoint, addKey, typed, slug }) => {
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
