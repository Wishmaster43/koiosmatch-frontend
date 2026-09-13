/**
 * SchemaSection — a placeholder/unit key the active locale has not translated must
 * render NOTHING, never the raw i18n key (Danny 13-09, row 2.2: the embedded
 * catalogue block on #settings/company/company showed
 * "catalog.sections.company.fields.billing_email.placeholder" as the literal
 * placeholder text — t(key, '') does not fall back to '' under
 * returnEmptyString:false, so the missing-translation echo leaked into the UI).
 */
import { render, screen, waitFor } from '@testing-library/react'
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
