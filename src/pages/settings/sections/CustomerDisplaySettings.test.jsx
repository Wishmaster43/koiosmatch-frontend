/**
 * customerDisplay schema (rendered via the generic SchemaSection) —
 * CHIPKLEUR-INSTELBAAR-1 coverage: an absent toggle/colour must keep today's
 * behaviour (nothing changes until a tenant saves something), and an invalid
 * colour must be rejected IN THE FIELD before it ever reaches the API — mirrors
 * the backend's ChipColor rule (App\Rules\ChipColor) so a tenant gets a useful
 * message instead of a 422.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import SchemaSection from '../components/SchemaSection'
import customerDisplay from '../schemas/customerDisplay'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key) => i18n.t(key, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({})
})

describe('customerDisplay · new toggle flags default ON (today\'s behaviour)', () => {
  it.each([
    'customer_contact_table_color_location',
    'customer_contact_table_color_department',
    'customer_department_table_color_location',
    'customer_location_table_color_status',
    'customer_department_table_color_status',
  ])('%s stays checked when absent from /settings', async (key) => {
    render(<SchemaSection schema={customerDisplay} />)
    const label = st(`customerDisplay.fields.${key}.label`)
    await waitFor(() => expect(screen.getByRole('switch', { name: label })).toBeInTheDocument())
    expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('customerDisplay · chip colours keep the documented default when absent', () => {
  it('pre-fills the location/department chip colour fields with the backend fallback', async () => {
    render(<SchemaSection schema={customerDisplay} />)
    const locationLabel = st('customerDisplay.fields.customer_location_chip_color.label')
    const departmentLabel = st('customerDisplay.fields.customer_department_chip_color.label')
    await waitFor(() => expect(screen.getByRole('textbox', { name: locationLabel })).toHaveValue('var(--color-secondary)'))
    expect(screen.getByRole('textbox', { name: departmentLabel })).toHaveValue('var(--color-violet)')
  })
})

describe('customerDisplay · invalid colour is rejected in the field (CHIPKLEUR-INSTELBAAR-1)', () => {
  it('shows the validation message and never becomes savable for a bad value', async () => {
    render(<SchemaSection schema={customerDisplay} />)
    const locationLabel = st('customerDisplay.fields.customer_location_chip_color.label')
    const input = await screen.findByRole('textbox', { name: locationLabel })

    // Not a hex, not a --color-* token — the exact shape App\Rules\ChipColor rejects.
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
    fireEvent.blur(input)

    expect(await screen.findByText(st('common.invalidColorValue'))).toBeInTheDocument()
    // Nothing became dirty, so Save must stay disabled — the invalid value never
    // reaches the form's own values, let alone the API.
    expect(screen.getByRole('button', { name: st('common.save') })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: st('common.save') }))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('accepts a valid hex value, clears the error and saves the exact key', async () => {
    render(<SchemaSection schema={customerDisplay} />)
    const locationLabel = st('customerDisplay.fields.customer_location_chip_color.label')
    const input = await screen.findByRole('textbox', { name: locationLabel })

    // eslint-disable-next-line no-restricted-syntax -- DATA: a tenant-typed hex value under test, not a UI colour choice
    fireEvent.change(input, { target: { value: '#0EA5E9' } })
    fireEvent.blur(input)
    expect(screen.queryByText(st('common.invalidColorValue'))).toBeNull()

    // 10s budget: under full-suite CPU load the form's async load+dirty cycle can
    // exceed waitFor's 1s default (measured 3048ms on a saturated 8-way run, so
    // the earlier 3s budget still lost the race) — the assertion itself is not
    // timing-sensitive, only slow.
    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    }, { timeout: 10000 })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/settings')
    // eslint-disable-next-line no-restricted-syntax -- DATA: the same tenant-typed hex value entered above
    expect(body.customer_location_chip_color).toBe('#0EA5E9')
  })
})
