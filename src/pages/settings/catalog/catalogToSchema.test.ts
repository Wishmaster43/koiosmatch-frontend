/**
 * catalogToSchema — tests conversion of catalogue rows to schema, type mapping,
 * enum option keys, and filtering of dedicated rows.
 */
import { describe, it, expect } from 'vitest'
import { catalogToSchema } from './catalogToSchema'
import { catalogFixture } from './catalogFixture'

describe('catalogToSchema', () => {
  it('converts all row types correctly: boolean → toggle, integer → number, string → text', () => {
    const section = catalogFixture.data.sections[2] // messaging section
    const schema = catalogToSchema('messaging', section.keys)

    // Verify field types were mapped.
    const toggleField = schema.fields.find(f => f.key === 'notifications_candidates_enabled')
    expect(toggleField?.type).toBe('toggle')

    const intField = catalogFixture.data.sections[0].keys[0] // no_contact_days
    const intSchema = catalogToSchema('windows', [intField])
    expect(intSchema.fields[0].type).toBe('number')
    expect(intSchema.fields[0].min).toBe(1)
    expect(intSchema.fields[0].max).toBe(365)
  })

  it('handles enum rows with option keys', () => {
    const section = catalogFixture.data.sections[2] // messaging with enum
    const schema = catalogToSchema('messaging', section.keys)

    const enumField = schema.fields.find(f => f.key === 'notification_channel')
    expect(enumField?.type).toBe('select')
    expect(enumField?.options?.length).toBe(2)
    expect(enumField?.options?.[0].label).toBe('settings.messaging.notification_channel.options.email')
  })

  it('filters out dedicated rows (ui !== generic)', () => {
    const rows = [
      {
        key: 'generic_row',
        section: 'test',
        type: 'boolean' as const,
        rules: [],
        default: true,
        aliases: [],
        label_key: 'test.generic',
        ui: 'generic' as const,
        fe_screen: 'test',
      },
      {
        key: 'dedicated_row',
        section: 'test',
        type: 'string' as const,
        rules: [],
        default: '',
        aliases: [],
        label_key: 'test.dedicated',
        ui: 'dedicated' as const,
        fe_screen: 'test',
      },
    ]

    const schema = catalogToSchema('test', rows)
    expect(schema.fields).toHaveLength(1)
    expect(schema.fields[0].key).toBe('generic_row')
  })

  it('includes labelKey and helpKey in the schema fields', () => {
    const row = catalogFixture.data.sections[0].keys[0]
    const schema = catalogToSchema('windows', [row])

    expect(schema.fields[0].labelKey).toBe(row.label_key)
    expect(schema.fields[0].helpKey).toBe(row.help_key)
  })

  it('includes format for json rows', () => {
    const section = catalogFixture.data.sections[4] // kpi section with json
    const schema = catalogToSchema('kpi', section.keys)

    const jsonField = schema.fields.find(f => f.type === 'json')
    expect(jsonField?.format).toBe('kpi_order')
  })
})

// SETTINGS-UNIT-PAIRS-1: `unit_of` → SchemaField.unitOf, `window_keys` → windowKeys,
// and a `string` row that still carries `options` (an older BE shape) renders as a select.
describe('catalogToSchema · SETTINGS-UNIT-PAIRS-1', () => {
  const baseRow = (overrides: Record<string, unknown>) => ({
    key: 'x', section: 'windows', type: 'integer', rules: [], default: 1, aliases: [],
    label_key: 'settings.windows.x.label', ui: 'generic', fe_screen: null, ...overrides,
  }) as Parameters<typeof catalogToSchema>[1][number]

  it('maps unit_of to the schema field\'s unitOf', () => {
    const row = { key: 'candidate_no_contact_days_unit', section: 'windows', type: 'enum', rules: [], default: 'days', aliases: [],
      label_key: 'settings.windows.candidate_no_contact_days_unit.label', ui: 'generic', fe_screen: null,
      options: ['days', 'weeks'], unit_of: 'candidate_no_contact_days' } as Parameters<typeof catalogToSchema>[1][number]
    const schema = catalogToSchema('windows', [row])
    expect(schema.fields[0].type).toBe('select')
    expect(schema.fields[0].unitOf).toBe('candidate_no_contact_days')
  })

  it('maps window_keys to the schema field\'s windowKeys', () => {
    const row = { key: 'koios_suggest_task_overdue', section: 'windows', type: 'boolean', rules: [], default: false, aliases: [],
      label_key: 'settings.windows.koios_suggest_task_overdue.label', ui: 'generic', fe_screen: null,
      window_keys: ['koios_suggest_task_overdue_days', 'koios_suggest_task_overdue_days_unit'] } as Parameters<typeof catalogToSchema>[1][number]
    const schema = catalogToSchema('windows', [row])
    expect(schema.fields[0].type).toBe('toggle')
    expect(schema.fields[0].windowKeys).toEqual(['koios_suggest_task_overdue_days', 'koios_suggest_task_overdue_days_unit'])
  })

  it('renders a `string` row with options as a select, same as an `enum` row', () => {
    const row = baseRow({ type: 'string', default: 'days', options: [{ value: 'days', label_key: 'settings.options.window_unit.days' }] })
    const schema = catalogToSchema('windows', [row])
    expect(schema.fields[0].type).toBe('select')
    expect(schema.fields[0].options).toEqual([{ value: 'days', label: 'settings.options.window_unit.days' }])
  })

  it('a plain `string` row with no options still renders as text', () => {
    const row = baseRow({ type: 'string', default: '' })
    const schema = catalogToSchema('windows', [row])
    expect(schema.fields[0].type).toBe('text')
  })
})

// SETTINGS-CATALOG-1 (measured 10-09): pattern rows and bare string options.
describe('catalogToSchema · landed envelope', () => {
  it('skips a pattern row (a key family, no single field) and reads a bare string option as its own label', () => {
    const rows = [
      { key: 'email_<context>_<field>', section: 'email', type: 'string', rules: [], default: null, aliases: [], label_key: 'settings.email.field.label', ui: 'generic', fe_screen: null, pattern: true },
      { key: 'email_default_from', section: 'email', type: 'string', rules: [], default: null, aliases: [], label_key: 'settings.email.email_default_from.label', ui: 'generic', fe_screen: null },
      { key: 'candidate_dedupe_keys', section: 'action_rules', type: 'enum', rules: [], default: null, aliases: [], label_key: 'x', ui: 'generic', fe_screen: null, options: ['email', 'mobile'] },
    ] as Parameters<typeof catalogToSchema>[1]
    const schema = catalogToSchema('email', rows)
    expect(schema.fields.map(f => f.key)).toEqual(['email_default_from', 'candidate_dedupe_keys'])
    expect(schema.fields[1].options).toEqual([{ value: 'email', label: 'email' }, { value: 'mobile', label: 'mobile' }])
  })
})

// CATALOG-GROUPS-1: blocks in the section's declared order, unlisted groups appended, fields carry their group.
describe('catalogToSchema · groups', () => {
  const row = (key: string, group?: string, icon?: string) => ({ key, section: 'company', type: 'string', rules: [], default: null, aliases: [], label_key: `settings.company.${key}.label`, ui: 'generic', fe_screen: null, ...(group && { group, group_label_key: `settings.groups.${group}`, group_icon: icon ?? null }) })
  it('orders the blocks by the section, appends a group the section did not list, and keeps ungrouped fields', () => {
    const rows = [row('company_currency', 'region', 'globe'), row('company_street', 'address', 'map-pin'), row('billing_email', 'billing'), row('company_language', 'region'), row('loose')] as Parameters<typeof catalogToSchema>[1]
    const schema = catalogToSchema('company', rows, { groups: ['address', 'region'], color: 'var(--color-info)' })
    expect(schema.groups?.map(g => g.key)).toEqual(['address', 'region', 'billing'])
    expect(schema.groups?.[0]).toEqual({ key: 'address', labelKey: 'settings.groups.address', icon: 'map-pin' })
    expect(schema.color).toBe('var(--color-info)')
    expect(schema.fields.find(f => f.key === 'company_language')?.group).toBe('region')
    expect(schema.fields.find(f => f.key === 'loose')?.group).toBeUndefined()
  })
  it('carries no groups at all for an envelope without them (one headless list, as before)', () => {
    const schema = catalogToSchema('company', [row('company_currency'), row('loose')] as Parameters<typeof catalogToSchema>[1])
    expect(schema.groups).toBeUndefined()
    expect(schema.color).toBeUndefined()
  })
})

// CATALOG-EMBED-1: `meta.group` narrows a section to ONE block. F1 (Opus review
// 13-09): the block is HEADED only when the host needs a label at all — page mode
// already shows the section title as its own PageTitle, so it renders headless
// there (`headed: false`); embedded mode (or no `headed` at all) keeps the heading,
// by the section's own title/icon by default, or the row's own group label/icon
// when `headedBy: 'group'` (a host whose page title already says the section itself).
describe('catalogToSchema · single-group narrowing (CATALOG-EMBED-1)', () => {
  const row = (key: string, group: string) => ({ key, section: 'windows', type: 'integer' as const, rules: [], default: 1, aliases: [], label_key: `settings.windows.${key}.label`, ui: 'generic' as const, fe_screen: null, group, group_label_key: `settings.groups.${group}`, group_icon: 'users' })

  it('embedded (headed, default): renders one block headed by the section title/icon', () => {
    const rows = [row('candidate_no_contact_days', 'candidates'), row('customer_no_contact_days', 'customers')]
    // A design token stands in for the contract's own hex here — the ceiling gate
    // (huisstijl-ceiling.mjs) counts a disable as drift too, so a real hex literal
    // is never the right way to satisfy a colour-shaped test fixture.
    const schema = catalogToSchema('windows', rows, { group: 'candidates', color: 'var(--color-warning-text)', sectionIcon: 'clock' })
    expect(schema.fields.map(f => f.key)).toEqual(['candidate_no_contact_days'])
    expect(schema.groups).toEqual([{ key: 'candidates', labelKey: 'catalog.sections.windows.title', icon: 'clock' }])
    expect(schema.color).toBe('var(--color-warning-text)')
    expect(schema.sectionId).toBe('windows')
  })

  it('page mode (headed: false): the fields still render, but headless — no group block at all', () => {
    const rows = [row('candidate_no_contact_days', 'candidates')]
    const schema = catalogToSchema('windows', rows, { group: 'candidates', sectionIcon: 'clock', headed: false })
    expect(schema.fields.map(f => f.key)).toEqual(['candidate_no_contact_days'])
    expect(schema.groups).toBeUndefined()
  })

  it('headedBy: "group" reads the row\'s own group label/icon instead of the section title', () => {
    const rows = [row('candidate_no_contact_days', 'candidates')]
    const schema = catalogToSchema('retention', rows, { group: 'candidates', headedBy: 'group' })
    expect(schema.groups).toEqual([{ key: 'candidates', labelKey: 'settings.groups.candidates', icon: 'users' }])
  })

  it('a group with no rows yields no fields and no block at all', () => {
    const rows = [row('customer_no_contact_days', 'customers')]
    const schema = catalogToSchema('windows', rows, { group: 'opportunities', sectionIcon: 'clock' })
    expect(schema.fields).toEqual([])
    expect(schema.groups).toBeUndefined()
  })

  // SETTINGS-UNIT-PAIRS-1: a switch in the narrowed group names a window pair that
  // lives in a DIFFERENT group (BE CatalogRows.php: candidate_no_contact_days sits
  // in group 'candidates', not 'koios_suggest') — both companions still ride along.
  it('pulls in a window pair\'s companion rows even when they sit in a different group', () => {
    const toggle = {
      key: 'koios_suggest_no_contact', section: 'windows', type: 'boolean' as const, rules: [], default: false, aliases: [],
      label_key: 'settings.windows.koios_suggest_no_contact.label', ui: 'generic' as const, fe_screen: null,
      group: 'koios_suggest', group_label_key: 'settings.groups.koios_suggest',
      window_keys: ['candidate_no_contact_days', 'candidate_no_contact_days_unit'] as [string, string],
    }
    const amount = {
      key: 'candidate_no_contact_days', section: 'windows', type: 'integer' as const, rules: [], default: 14, aliases: [],
      label_key: 'settings.windows.candidate_no_contact_days.label', ui: 'generic' as const, fe_screen: null, group: 'candidates',
    }
    // The unit is `dedicated` on purpose (measured 29-09: the opportunity_closing_soon pair
    // is dedicated on the BE and the switch lost its window) — a companion rides along whatever its `ui`.
    const unit = {
      key: 'candidate_no_contact_days_unit', section: 'windows', type: 'enum' as const, rules: [], default: 'days', aliases: [],
      label_key: 'settings.windows.candidate_no_contact_days_unit.label', ui: 'dedicated' as const, fe_screen: null, group: 'candidates',
      options: ['days', 'weeks'], unit_of: 'candidate_no_contact_days',
    }
    // A row of an unrelated group must NOT leak in.
    const unrelated = {
      key: 'opportunity_closing_soon_days', section: 'windows', type: 'integer' as const, rules: [], default: 7, aliases: [],
      label_key: 'settings.windows.opportunity_closing_soon_days.label', ui: 'generic' as const, fe_screen: null, group: 'opportunities',
    }
    const schema = catalogToSchema('windows', [toggle, amount, unit, unrelated], { group: 'koios_suggest' })
    expect(schema.fields.map(f => f.key)).toEqual(['koios_suggest_no_contact', 'candidate_no_contact_days', 'candidate_no_contact_days_unit'])
  })

  // A one-key window ([amount] without a unit row, the interview_stalled hours) keeps its amount
  // as the switch's inline companion; nothing else is pulled in.
  it('keeps a one-key window\'s amount as the companion of its switch', () => {
    const toggle = {
      key: 'koios_suggest_interview_stalled', section: 'windows', type: 'boolean' as const, rules: [], default: true, aliases: [],
      label_key: 'settings.windows.koios_suggest_interview_stalled.label', ui: 'generic' as const, fe_screen: null,
      group: 'koios_suggest', group_label_key: 'settings.groups.koios_suggest',
      window_keys: ['koios_suggest_interview_stalled_hours'],
    }
    const hours = {
      key: 'koios_suggest_interview_stalled_hours', section: 'windows', type: 'integer' as const, rules: [], default: 24, aliases: [],
      label_key: 'settings.windows.koios_suggest_interview_stalled_hours.label', ui: 'generic' as const, fe_screen: null, group: 'koios_suggest',
    }
    const schema = catalogToSchema('windows', [toggle, hours], { group: 'koios_suggest' })
    expect(schema.fields.map(f => f.key)).toEqual(['koios_suggest_interview_stalled', 'koios_suggest_interview_stalled_hours'])
    expect(schema.fields[0].windowKeys).toEqual(['koios_suggest_interview_stalled_hours'])
  })
})
