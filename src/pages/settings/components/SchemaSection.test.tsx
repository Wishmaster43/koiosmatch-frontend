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

// getActiveTenantId: StageWindowMapField (mounted for the stage_window_map field
// test below) pulls in useApplicationStages → useCachedLookup, which reads it.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn() }, getActiveTenantId: () => 'test-tenant' }))
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

  // A CATALOGUE row names its own label key (settings.windows.<key>.label); its unit
  // lives next to it, not under the folder convention — measured 29-09: the interview
  // hours row's "uur" never rendered because only `${base}.unit` was read.
  it('renders a catalogue number row\'s unit from the sibling of its own label key', async () => {
    i18n.addResource(i18n.language, 'settings', 'settings.windows.stalled_hours_test_only.label', 'Wacht na')
    i18n.addResource(i18n.language, 'settings', 'settings.windows.stalled_hours_test_only.unit', 'uur-test')
    const schema: Schema = {
      i18nKey: 'catalog.sections.windows',
      fields: [{ key: 'stalled_hours_test_only', type: 'number', default: 24, labelKey: 'settings.windows.stalled_hours_test_only.label' }],
    }
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findByText('uur-test')).toBeInTheDocument()
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

// SETTINGS-UNIT-PAIRS-1: a toggle row with `windowKeys` renders its amount + unit
// inline right of the switch, and the standalone amount/unit rows are hidden (no
// double truth — the switch/window pair is the ONE place those two keys render).
describe('SchemaSection · toggle windowKeys pair', () => {
  const schema: Schema = {
    i18nKey: 'catalog.sections.windows',
    fields: [
      { key: 'koios_suggest_task_overdue', type: 'toggle', default: false, windowKeys: ['koios_suggest_task_overdue_days', 'koios_suggest_task_overdue_days_unit'],
        labelKey: 'catalog.sections.windows.fields.koios_suggest_task_overdue.label' },
      { key: 'koios_suggest_task_overdue_days', type: 'number', default: 1, min: 1, max: 90,
        labelKey: 'catalog.sections.windows.fields.koios_suggest_task_overdue_days.label' },
      {
        key: 'koios_suggest_task_overdue_days_unit', type: 'select', unitOf: 'koios_suggest_task_overdue_days', default: 'days',
        options: [{ value: 'days', label: 'catalog.sections.windows.fields.koios_suggest_task_overdue_days_unit.options.days' },
          { value: 'weeks', label: 'catalog.sections.windows.fields.koios_suggest_task_overdue_days_unit.options.weeks' }],
        labelKey: 'catalog.sections.windows.fields.koios_suggest_task_overdue_days_unit.label',
      },
    ],
  }

  it('renders the toggle, its amount and its unit in one row, with no separate standalone rows', async () => {
    render(<SchemaSection schema={schema} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'))
    expect(await screen.findByRole('switch')).toBeInTheDocument()
    // The amount is a numeric textbox, the unit a searchable select trigger — both inline, once each.
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: i18n.t('catalog.sections.windows.fields.koios_suggest_task_overdue_days_unit.label', { ns: 'settings' }) }))
      .toHaveLength(1)
  })

  it('POSTs the switch, its amount and its unit on save', async () => {
    render(<SchemaSection schema={schema} />)
    const toggle = await screen.findByRole('switch')
    fireEvent.click(toggle)

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    // Other tests in this file also call api.post (no cross-test mock reset here,
    // matching the file's existing pattern) — pick THIS test's own call by its key.
    const call = vi.mocked(api.post).mock.calls.find(c => 'koios_suggest_task_overdue' in (c[1] as Record<string, string>))
    expect(call?.[1]).toMatchObject({ koios_suggest_task_overdue: 'true' })
  })

  // Changing the UNIT (not the amount) must post the unit key too — a toMatchObject
  // on only the switch key would let a silently-dropped unit change pass.
  it('POSTs the chosen unit under its own key when only the unit is changed', async () => {
    render(<SchemaSection schema={schema} />)
    await screen.findByRole('switch')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('catalog.sections.windows.fields.koios_suggest_task_overdue_days_unit.label', { ns: 'settings' }) }))
    fireEvent.click(await screen.findByText('weeks'))

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    // api.post.mock.calls is NOT reset between tests in this file (see the comment on
    // the sibling test above) — the earlier test's own call also carries this field's
    // key (unchanged, 'days'), so pick THIS test's call by its distinguishing value.
    const call = vi.mocked(api.post).mock.calls.find(c => (c[1] as Record<string, string>).koios_suggest_task_overdue_days_unit === 'weeks')
    expect(call?.[1]).toEqual({
      koios_suggest_task_overdue: 'false',
      koios_suggest_task_overdue_days: '1',
      koios_suggest_task_overdue_days_unit: 'weeks',
    })
  })
})

// SETTINGS-UNIT-PAIRS-1: a `stage_window_map` field persists ITSELF (StageWindowMapField
// writes its own key per row); the section's own Save must never repost the mount-time
// JSON for that field, or it would overwrite whatever the table just persisted live.
describe('SchemaSection · stage_window_map field excluded from the section save', () => {
  const schema: Schema = {
    i18nKey: 'catalog.sections.windows',
    fields: [
      { key: 'other_field', type: 'number', default: 1, labelKey: 'catalog.sections.windows.fields.other_field.label' },
      { key: 'application_stage_stale_by_phase', type: 'json', format: 'stage_window_map', default: '{}',
        labelKey: 'catalog.sections.windows.fields.application_stage_stale_by_phase.label' },
    ],
  }

  it('does not include the stage_window_map key in the section\'s own save POST', async () => {
    render(<SchemaSection schema={schema} />)
    // StageWindowMapField mounts alongside `other_field` and adds its own amount
    // textboxes (one per application stage) — name the field's own input explicitly.
    const input = await screen.findByRole('textbox', { name: 'catalog.sections.windows.fields.other_field.label' })
    fireEvent.change(input, { target: { value: '5' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    // api.post.mock.calls accumulates across this file's tests (not reset) — take
    // this test's own call, the LAST one, not the first ever recorded.
    const calls = vi.mocked(api.post).mock.calls
    const [, body] = calls[calls.length - 1] as [string, Record<string, string>]
    expect(body.other_field).toBe('5')
    expect(body).not.toHaveProperty('application_stage_stale_by_phase')
  })
})
