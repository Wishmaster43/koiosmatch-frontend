/**
 * SchemaSection — a placeholder/unit key the active locale has not translated must
 * render NOTHING, never the raw i18n key (Danny 13-09, row 2.2: the embedded
 * catalogue block on #settings/company/company showed
 * "catalog.sections.company.fields.billing_email.placeholder" as the literal
 * placeholder text — t(key, '') does not fall back to '' under
 * returnEmptyString:false, so the missing-translation echo leaked into the UI).
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import api from '@/lib/api'
import i18n from '@/i18n'
import SchemaSection from './SchemaSection'
import type { Schema } from './SchemaSection'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

describe('SchemaSection · optional placeholder/unit', () => {
  it('renders a text field with no translated placeholder with no placeholder attribute at all', async () => {
    const schema: Schema = {
      i18nKey: 'catalog.sections.company',
      fields: [{ key: 'billing_email', type: 'text', default: '', labelKey: 'catalog.sections.company.fields.billing_email.label' }],
    }
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    const input = await screen.findByRole('textbox')
    expect(input).not.toHaveAttribute('placeholder')
  })

  it('renders a number field with no translated unit with no unit text, not the raw key', async () => {
    const schema: Schema = {
      i18nKey: 'catalog.sections.company',
      fields: [{ key: 'no_unit_number', type: 'number', default: 1, labelKey: 'catalog.sections.company.fields.no_unit_number.label' }],
    }
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(screen.queryByText('catalog.sections.company.fields.no_unit_number.unit')).toBeNull()
  })

  // F7 (Opus review 13-09): the positive case — a row WHOSE placeholder key IS
  // translated must actually render it, proving optionalT doesn't swallow a real
  // translation along with the missing-key echo. Registers the key on the REAL
  // i18n singleton (mirrors how other settings tests read the loaded nl bundle
  // via `i18n.t(...)`), rather than a mock that could hide a regression here.
  it('renders a text field WITH a translated placeholder', async () => {
    const key = 'catalog.sections.company.fields.billing_email_test_only.placeholder'
    const text = 'facturen@voorbeeld.nl'
    i18n.addResource(i18n.language, 'settings', key, text)
    const schema: Schema = {
      i18nKey: 'catalog.sections.company',
      fields: [{ key: 'billing_email_test_only', type: 'text', default: '', labelKey: 'catalog.sections.company.fields.billing_email_test_only.label' }],
    }
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findByPlaceholderText(text)).toBeInTheDocument()
  })
})

// O23 UNIT-NAAST-BEDRAG-1: a `unitOf` companion field renders inline right of its
// amount, as ONE row (never a second row of its own), and both keys save together.
describe('SchemaSection · unitOf companion field', () => {
  const schema: Schema = {
    i18nKey: 'catalog.sections.company',
    fields: [
      { key: 'stale_days', type: 'number', default: 14, labelKey: 'catalog.sections.company.fields.stale_days.label' },
      {
        key: 'stale_days_unit', type: 'select', unitOf: 'stale_days', default: 'days',
        options: [{ value: 'days', label: 'catalog.sections.company.fields.stale_days_unit.options.days' },
          { value: 'weeks', label: 'catalog.sections.company.fields.stale_days_unit.options.weeks' }],
        labelKey: 'catalog.sections.company.fields.stale_days_unit.label',
      },
    ],
  }

  it('renders the number field and its unit picker in one row, not two', async () => {
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findAllByRole('textbox')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: i18n.t('catalog.sections.company.fields.stale_days_unit.label', { ns: 'settings' }) }))
      .toHaveLength(1)
  })

  it('POSTs both the amount and the chosen unit on save', async () => {
    render(<SchemaSection schema={schema} />)
    const input = await screen.findByRole('textbox')
    await waitFor(() => expect(input).toHaveValue('14'))
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('catalog.sections.company.fields.stale_days_unit.label', { ns: 'settings' }) }))
    // FieldControl's select case falls back to the option's own value ('weeks') when
    // its label key has no translation — the option's own `default` argument to t().
    fireEvent.click(await screen.findByText('weeks'))

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(body.stale_days).toBe('30')
    expect(body.stale_days_unit).toBe('weeks')
  })
})
