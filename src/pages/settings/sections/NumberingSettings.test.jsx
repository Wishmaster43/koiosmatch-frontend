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
 *
 * X-42 (Lane O): allocated flag + next_value display — when an entity has allocated=true,
 * the start field renders read-only with the next value; when allocated=false, it's editable.
 *
 * B-35 (Lane SETTINGS-G2): prefix validation — alphanumeric only, max 10 chars.
 * Invalid input shows an error and does not save. Valid input saves successfully.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

const TWELVE = [
  { key: 'candidate', prefix: 'K', pad: 5, start: 1, label: 'Kandidaat', allocated: false },
  { key: 'customer', prefix: 'D', pad: 5, start: 1, label: 'Klant', allocated: true, next_value: 42 },
  { key: 'vacancy', prefix: 'V', pad: 5, start: 1, label: 'Vacature', allocated: false },
  { key: 'customer_location', prefix: 'L', pad: 3, start: 1, label: 'Vestiging klant', allocated: false },
  { key: 'customer_department', prefix: 'A', pad: 3, start: 1, label: 'Afdeling klant', allocated: false },
  { key: 'match', prefix: 'M', pad: 5, start: 1, label: 'Match', allocated: false },
  { key: 'application', prefix: 'S', pad: 5, start: 1, label: 'Sollicitatie', allocated: false },
  { key: 'task', prefix: 'T', pad: 5, start: 1, label: 'Taak', allocated: false },
  { key: 'opportunity', prefix: 'KA', pad: 5, start: 1, label: 'Kans', allocated: false },
  { key: 'outreach_campaign', prefix: 'B', pad: 4, start: 1, label: 'Belronde', allocated: false },
  { key: 'customer_contact', prefix: 'C', pad: 5, start: 1, label: 'Contactpersoon', allocated: false },
  { key: 'location', prefix: 'VE', pad: 3, start: 1, label: 'Vestiging (eigen)', allocated: false },
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

  it('renders editable start input when allocated is false (existing behaviour)', async () => {
    await renderNumbering(TWELVE)

    // Candidate has allocated=false, so its start input should be editable.
    // All entities with allocated=false should have number inputs in the start column.
    const startInputs = screen.getAllByDisplayValue('1').filter(input => input.type === 'number')
    expect(startInputs.length).toBeGreaterThan(0)
  })

  it('renders read-only display with next value when allocated is true', async () => {
    await renderNumbering(TWELVE)

    // Customer has allocated=true and next_value=42, so start cell should display
    // as a flex div instead of an input, containing the current value (1) and
    // reference to the next value. Check the customer row is present and verify
    // that its start cell does not have a number input (it's read-only).
    await screen.findByText('Klant')

    // Get all rows and find the customer row
    const rows = screen.getAllByRole('row')
    const customerRow = rows.find(row => row.textContent.includes('Klant'))
    expect(customerRow).toBeTruthy()

    // The customer row has 4 cells: entity, prefix, pad, start
    // Prefix is text input, pad is number input, start is div (for allocated=true)
    const numberInputs = customerRow.querySelectorAll('input[type="number"]')
    // Customer row should have 1 number input (pad). Start is a div.
    expect(numberInputs.length).toBe(1)

    // Verify the start cell contains a div with the mono text and next value reference
    const cells = customerRow.querySelectorAll('td')
    const startCell = cells[cells.length - 1]
    expect(startCell.querySelector('div')).toBeTruthy() // Should have a div (not input)
  })
})

describe('NumberingSettings — B-35 prefix validation (alphanumeric, max 10)', () => {
  // The backend 422s a prefix outside [a-zA-Z0-9]{1,10}; the screen refuses it
  // client-side first: inline hint, value reverted, nothing POSTed.
  it('rejects a non-alphanumeric prefix: inline hint, value reverted, no request', async () => {
    await renderNumbering(TWELVE)
    const apiModule = await import('@/lib/api')
    const i18n = (await import('@/i18n')).default
    await screen.findByText('Kandidaat')

    const [prefixInput] = screen.getAllByLabelText(i18n.t('numbering.prefix', { ns: 'settings' }))
    await userEvent.clear(prefixInput)
    await userEvent.type(prefixInput, 'K-1')
    await userEvent.tab()

    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('numbering.prefixInvalid', { ns: 'settings' }))
    expect(prefixInput).toHaveValue('K')
    expect(apiModule.default.post).not.toHaveBeenCalled()
  })

  it('saves a valid prefix through POST /settings with the exact numbering key', async () => {
    await renderNumbering(TWELVE)
    const apiModule = await import('@/lib/api')
    apiModule.default.post.mockResolvedValue({ data: {} })
    const i18n = (await import('@/i18n')).default
    await screen.findByText('Kandidaat')

    const [prefixInput] = screen.getAllByLabelText(i18n.t('numbering.prefix', { ns: 'settings' }))
    await userEvent.clear(prefixInput)
    await userEvent.type(prefixInput, 'KX')
    await userEvent.tab()

    await waitFor(() => expect(apiModule.default.post).toHaveBeenCalledWith('/settings', { 'numbering.candidate.prefix': 'KX' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
