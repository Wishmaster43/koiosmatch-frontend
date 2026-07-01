/**
 * FieldInput — the workflow config-panel field dispatcher: one form control per
 * schema `field.type`. The plain inline controls (boolean/multiselect/select/
 * textarea/keyvalue/text/number/date) live here; the data-fetching + nested
 * builders (agent/faq/webhook pickers, filters, response-structure) are delegated
 * to `./fieldControls`. Extracted from WorkflowCanvasEditor.
 */
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkflowField, EdgeFilters, WorkflowVarGroup } from '@/types/workflow'
import {
  FaqSelectField, WebhookSelectField,
  FiltersField, ResponseStructureField, type OnChange,
} from './fieldControls'
import { TextFieldWithVars } from './VariablePicker'

export function FieldInput({ field, value, onChange, variables }: {
  field: WorkflowField; value?: unknown; onChange: OnChange; variables?: WorkflowVarGroup[]
}) {
  const { t } = useTranslation('workflows')
  if (field.type === 'webhook_select') {
    return <WebhookSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'filters') {
    return <FiltersField field={field} value={value as EdgeFilters | undefined} onChange={onChange} />
  }
  if (field.type === 'faq_select') {
    return <FaqSelectField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'response_structure') {
    return <ResponseStructureField value={value} onChange={onChange} fieldKey={field.key} />
  }
  if (field.type === 'boolean') {
    return (
      <button type="button" onClick={() => onChange(field.key, !value)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ position: 'relative', width: 32, height: 17, borderRadius: 999, background: value ? 'var(--color-primary)' : 'var(--border)', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: value ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{value ? t('fields.boolOn') : t('fields.boolOff')}</span>
      </button>
    )
  }
  if (field.type === 'multiselect') {
    const selected: unknown[] = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(field.options ?? []).map(optRaw => {
          const opt = optRaw as string
          const active = selected.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(field.key, active ? selected.filter(v => v !== opt) : [...selected, opt])}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                color:      active ? 'var(--color-primary)'    : 'var(--text-muted)',
                border:     `1px solid ${active ? '#C4C0F0' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <select value={(value ?? field.default ?? '') as string} onChange={e => onChange(field.key, e.target.value)}
        aria-label={field.label}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none' }}>
        {field.default == null && <option value="">{t('fields.selectPlaceholder')}</option>}
        {(field.options ?? []).map(o => {
          const val = typeof o === 'object' ? o.value : o
          const lbl = typeof o === 'object' ? o.label : o
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    )
  }
  if (field.type === 'textarea') {
    // Attach the variable picker when upstream modules expose fields to reference.
    if (variables?.length) {
      return <TextFieldWithVars field={field} value={value} onChange={onChange} variables={variables} multiline />
    }
    return (
      <textarea value={(value as string) || ''} placeholder={field.placeholder || ''} aria-label={field.label}
        onChange={e => onChange(field.key, e.target.value)}
        rows={4}
        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }}
        onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
    )
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
            <button type="button" onClick={() => remove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 4px' }}>
              <X size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={add}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: '1px dashed var(--color-primary)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
          <Plus size={10} /> {t('fields.add')}
        </button>
      </div>
    )
  }
  // Plain single-line text gets the variable picker too (numbers/dates never do).
  if ((field.type === 'text' || field.type == null) && variables?.length) {
    return <TextFieldWithVars field={field} value={value} onChange={onChange} variables={variables} />
  }
  return (
    <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={(value as string) || ''}
      placeholder={field.placeholder || ''} aria-label={field.label}
      onChange={e => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
      onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
  )
}
