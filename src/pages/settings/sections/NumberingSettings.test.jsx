/**
 * NumberingSettings — NUMBERING-LOOKUP-1 (CMBE 04-08): the screen used to render a
 * hardcoded SIX-entity array while config/numbering.php defines TWELVE. This test
 * proves all twelve backend-configured entities render, including one of the six
 * new ones (no translation key yet — resolved via its t(key,{defaultValue}) fallback),
 * and that a backend outage still shows the seeded six rather than a blank table.
 *
 * useAllSettings/useNumberingEntities both cache at module scope, so each case needs
 * a FRESH module graph (vi.resetModules + dynamic re-import), same pattern as
 * FunctionsSettings.test.jsx. i18n is re-initialised in the SAME post-reset graph so
 * the component's own useTranslation() binds to an actually-initialised instance.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

const TWELVE = [
  { key: 'candidate', prefix: 'K', pad: 5, start: 1, label: 'Kandidaat' },
  { key: 'customer', prefix: 'D', pad: 5, start: 1, label: 'Klant' },
  { key: 'vacancy', prefix: 'V', pad: 5, start: 1, label: 'Vacature' },
  { key: 'customer_location', prefix: 'L', pad: 3, start: 1, label: 'Vestiging klant' },
  { key: 'customer_department', prefix: 'A', pad: 3, start: 1, label: 'Afdeling klant' },
  { key: 'match', prefix: 'M', pad: 5, start: 1, label: 'Match' },
  { key: 'application', prefix: 'S', pad: 5, start: 1, label: 'Sollicitatie' },
  { key: 'task', prefix: 'T', pad: 5, start: 1, label: 'Taak' },
  { key: 'opportunity', prefix: 'KA', pad: 5, start: 1, label: 'Kans' },
  { key: 'outreach_campaign', prefix: 'B', pad: 4, start: 1, label: 'Belronde' },
  { key: 'customer_contact', prefix: 'C', pad: 5, start: 1, label: 'Contactpersoon' },
  { key: 'location', prefix: 'VE', pad: 3, start: 1, label: 'Vestiging (eigen)' },
]

// Fresh module graph per test: routes /settings and /numbering-entities, re-inits
// the real i18n singleton, then dynamically re-imports the component under test.
async function renderNumbering(entitiesResponse) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation((url) => {
    if (url === '/settings') return Promise.resolve({ data: {} })
    if (url === '/numbering-entities') {
      return entitiesResponse instanceof Error
        ? Promise.reject(entitiesResponse)
        : Promise.resolve({ data: entitiesResponse })
    }
    return Promise.resolve({ data: {} })
  })
  await import('@/i18n')
  const { default: NumberingSettings } = await import('./NumberingSettings')
  return render(<NumberingSettings />)
}

describe('NumberingSettings — renders the backend entity list, not a hardcoded six', () => {
  it('renders all twelve configured entities, including a new one via its label fallback', async () => {
    await renderNumbering(TWELVE)

    // An entity with an existing translation key resolves through i18n…
    await screen.findByText('Kandidaat')
    // …one of the six NEW entities (no translation key yet) still shows a real
    // label via t(key, { defaultValue: entity.label }), never a raw i18n key.
    expect(screen.getByText('Taak')).toBeInTheDocument()
    expect(screen.queryByText(/numbering\.entities\.task/)).not.toBeInTheDocument()

    // Header row + twelve entity rows.
    expect(screen.getAllByRole('row')).toHaveLength(13)
  })

  it('falls back to the seeded six when the endpoint fails — never a blank table', async () => {
    await renderNumbering(new Error('network down'))

    await screen.findByText('Kandidaat')
    expect(screen.getAllByRole('row')).toHaveLength(7)
  })
})
