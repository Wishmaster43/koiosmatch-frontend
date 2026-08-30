/**
 * FieldInput — the workflow config-panel field dispatcher: one form control per
 * schema `field.type`. The plain inline controls (boolean/multiselect/select/
 * textarea/keyvalue/text/number/date) live here; the data-fetching + nested
 * builders (agent/faq/webhook pickers, filters) are delegated to `./fieldControls/`.
 * Extracted from WorkflowCanvasEditor.
 */
import { useId } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkflowField, EdgeFilters, WorkflowVarGroup } from '@/types/workflow'
import { FaqSelectField } from './fieldControls/FaqSelectField'
import { WebhookSelectField } from './fieldControls/WebhookSelectField'
import { LookupSelectField } from './fieldControls/LookupSelectField'
import { WorkflowSelectField } from './fieldControls/WorkflowSelectField'
import { WhatsappPhoneNumberField } from './fieldControls/WhatsappPhoneNumberField'
import { FiltersField } from './fieldControls/FiltersField'
import { OrderedListField } from './fieldControls/OrderedListField'
import { InstructionListField } from './fieldControls/InstructionListField'
import type { InstructionOutputField } from './filterFieldCatalog'
import type { OnChange } from './fieldControls/types'
import { KeyValueField, GroupField } from './groupKeyValueFields'
import { TextFieldWithVars } from './VariablePicker'
import { fieldLabel, fieldPlaceholder, optionLabel } from './moduleI18n'
import WhatsappTemplateField from './WhatsappTemplateField'
import MultiSelectField from './MultiSelectField'
// Danny 08-08 (§4): the house searchable combobox replaces the bare native
// <select> for the generic 'select' field type below.
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
// HUISSTIJL-1: the ONE toggle-switch implementation — replaces the hand-rolled
// track+thumb <button> the 'boolean' field used to paint itself.
import Toggle from '@/components/ui/Toggle'

// Dispatches one schema field type to its control; the data-fetching/nested field types delegate to fieldControls, this file only holds the plain inline ones (see the module doc above).
export function FieldInput({ field, value, onChange, variables, config, instructionOutputFields }: {
  field: WorkflowField; value?: unknown; onChange: OnChange; variables?: WorkflowVarGroup[]
  config?: Record<string, unknown>
  // INTERVIEW-WORKFLOW-1 CMBE delta: the server-served output_field allow-list for
  // the 'instruction_list' field type only; every other field type ignores it.
  instructionOutputFields?: InstructionOutputField[]
}) {
  const { t } = useTranslation('workflows')
  // Called unconditionally (rules-of-hooks) even though only the 'select' branch
  // below uses it — CreatableSelect's trigger is a <button>, which a plain
  // aria-label cannot name the way a native <select> could; a sr-only span +
  // aria-labelledby names it instead (mirrors AvailabilityEditor/ReportsPage).
  const selectLabelId = useId()
  if (field.type === 'webhook_select') {
    return <WebhookSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'filters') {
    return <FiltersField field={field} value={value as EdgeFilters | undefined} onChange={onChange} />
  }
  if (field.type === 'faq_select') {
    return <FaqSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'lookup_select') {
    // field.placeholder overrides the generic "select…" copy for the clear/empty
    // option (VAC-CLEAR-1) — e.g. interview_start's "default from vacancy/application".
    return <LookupSelectField value={value} onChange={onChange} fieldKey={field.key} endpoint={String(field.endpoint ?? '')} valueKey={typeof field.valueKey === 'string' ? field.valueKey : undefined} responseKey={typeof field.responseKey === 'string' ? field.responseKey : undefined} emptyLabel={field.placeholder ? fieldPlaceholder(t, field.placeholder) : undefined} />
  }
  if (field.type === 'whatsapp_phone_number') {
    // Reads the sibling `channel` field from the full node config to filter to
    // Coexistence-only sender numbers (CMBE K-193 fase 0).
    return <WhatsappPhoneNumberField value={value} onChange={onChange} fieldKey={field.key} endpoint={String(field.endpoint ?? '')} config={config} />
  }
  if (field.type === 'workflow') {
    // workflow_call's workflow_id picker (WF-RELATIONS-1): a searchable list of
    // this tenant's own workflows, fed by GET /workflows.
    return <WorkflowSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'whatsapp_template') {
    // Needs the full node config (not just this field's own value) to read the
    // sibling header_variables/variables/language keys it also writes to.
    return <WhatsappTemplateField value={value} onChange={onChange} config={config} variables={variables ?? []} />
  }
  if (field.type === 'boolean') {
    // Unset config falls back to the schema default — the toggle must paint what
    // the ENGINE will do (dry_run defaults ON server-side; showing "Uit" on a
    // fresh node would read as live writes while the engine dry-runs).
    const on = !!(value ?? field.default)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Toggle checked={on} onChange={v => onChange(field.key, v)} ariaLabel={fieldLabel(t, field.label) || field.key} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{on ? t('fields.boolOn') : t('fields.boolOff')}</span>
      </div>
    )
  }
  if (field.type === 'multiselect') {
    // WF-MULTISELECT-1 (Danny 23-07): searchable multi-select — tenant lookups via
    // `source` (statussen/fases/contractvormen), static options, or free entry (Plaats).
    return <MultiSelectField field={field} value={value} onChange={onChange} />
  }
  if (field.type === 'select') {
    // Normalise both accepted option shapes (a plain string or {value,label});
    // a leading blank entry is kept ONLY when the schema has no default — same
    // condition the native <select>'s own placeholder <option> used.
    const options = (field.options ?? []).map(o => {
      const val = typeof o === 'object' ? o.value : o
      const lbl = typeof o === 'object' ? o.label : o
      return { value: String(val), label: optionLabel(t, lbl as string) }
    })
    const withPlaceholder = field.default == null
      ? [{ value: '', label: t('fields.selectPlaceholder') }, ...options]
      : options
    return (
      <>
        <span id={selectLabelId} className="sr-only">{fieldLabel(t, field.label)}</span>
        <CreatableSelect value={(value ?? field.default ?? '') as string} onChange={v => onChange(field.key, v)}
          aria-labelledby={selectLabelId} allowCreate={false} options={withPlaceholder}
          placeholder={t('fields.selectPlaceholder')}
          style={{ width: '100%', padding: '7px 9px', fontSize: 13 }} />
      </>
    )
  }
  if (field.type === 'textarea') {
    // Attach the variable picker when upstream modules expose fields to reference.
    if (variables?.length) {
      return <TextFieldWithVars field={field} value={value} onChange={onChange} variables={variables} multiline />
    }
    return (
      <textarea value={(value as string) || ''} placeholder={fieldPlaceholder(t, field.placeholder)} aria-label={fieldLabel(t, field.label)}
        onChange={e => onChange(field.key, e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
    )
  }
  if (field.type === 'ordered_list') {
    // WA-SEND-FIELDS-2: WhatsAppSendModule's body_parameters — a positional
    // {{1}}, {{2}}, … list, so reordering matters (unlike 'keyvalue' below).
    return <OrderedListField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'instruction_list') {
    // INTERVIEW-WORKFLOW-1: ai_agent's `instructions` — a reorderable list of
    // rich-text AI-interview questions, each with an output-field mapping, a
    // required toggle and a per-row variable-insert/duplicate/delete menu.
    return <InstructionListField value={value} onChange={onChange} fieldKey={field.key} variables={variables} outputFields={instructionOutputFields} />
  }
  if (field.type === 'key_value') {
    // WA-SEND-FIELDS-2: a plain key->value record (see fieldControls' header
    // comment) — distinct from 'keyvalue' below, which persists a {name,value}[] array.
    return <KeyValueField value={value} onChange={onChange} fieldKey={field.key} suggestions={field.suggestions} />
  }
  if (field.type === 'group') {
    // WA-SEND-FIELDS-2: a titled sub-card per named sub-field (after_send_updates).
    return <GroupField field={field} value={value} onChange={onChange} />
  }
  if (field.type === 'keyvalue') {
    const pairs = (Array.isArray(value) ? value : []) as Array<{ name?: string; value?: string }>
    const update = (i: number, k: 'name' | 'value', v: string) => onChange(field.key, pairs.map((p, j) => j === i ? { ...p, [k]: v } : p))
    const add    = () => onChange(field.key, [...pairs, { name: '', value: '' }])
    const remove = (i: number) => onChange(field.key, pairs.filter((_, j) => j !== i))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pairs.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            <input value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder={t('fields.keyName')} aria-label={t('fields.keyName')}
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            <input value={p.value} onChange={e => update(i, 'value', e.target.value)} placeholder={t('fields.keyValue')} aria-label={t('fields.keyValue')}
              style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            <button type="button" onClick={() => remove(i)} aria-label={t('common:remove')} title={t('common:remove')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline row-remove inside a ~26px input row; Button sm's fixed 28px footprint breaks the row height (§14 r7 necessity)
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0 4px' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
        <DrawerAddButton onClick={add} label={t('fields.add')} />
      </div>
    )
  }
  // Plain single-line text gets the variable picker too (numbers/dates never do).
  if ((field.type === 'text' || field.type == null) && variables?.length) {
    return <TextFieldWithVars field={field} value={value} onChange={onChange} variables={variables} />
  }
  return (
    <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={(value ?? field.default ?? '') as string}
      placeholder={fieldPlaceholder(t, field.placeholder)} aria-label={fieldLabel(t, field.label)}
      onChange={e => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the config-panel text INPUT's own size/colour (SettingsSearch precedent), not a BodyText paragraph render
      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
      onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
  )
}
