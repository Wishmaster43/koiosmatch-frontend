// Extracted from EditableFieldTable (SIZE-SPLIT-B, zero behaviour change): the
// EDIT-mode control renderer, dispatched on a FieldRow's declared type.
import type { CSSProperties } from 'react'
import { DateField } from './fields'
import Toggle from '@/components/ui/Toggle'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { monoStyle } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { FieldRow } from './EditableFieldTable'

type Values = Record<string, unknown>

// Normalise FieldRow options for the searchable picker: it matches on text, so a
// ReactNode label (used by a few icon rows) falls back to the raw value.
const selectOptions = (options: FieldRow['options']): Array<{ value: string; label: string }> =>
  (options ?? []).map(o => (typeof o === 'string'
    ? { value: o, label: o }
    : { value: o.value, label: typeof o.label === 'string' ? o.label : o.value }))

// Render the EDIT-mode control for one field. Owns no state of its own — the
// draft, richtext-expand map and setters all live in the parent table.
export function renderFieldControl(f: FieldRow, ctx: {
  form: Values; setF: (k: string, v: unknown) => void
  compact: CSSProperties; t: (key: string) => string
  richExpanded: Record<string, boolean>; setRichExpanded: (updater: (p: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const { form, setF, compact, t, richExpanded, setRichExpanded } = ctx
  const v = form[f.key]
  // A boolean field is a TOGGLE, never a tick box (Danny: "GEEN VINKJES MAAR
  // TOGGLES!!", repeated 28-07 for the primary-contact flag). One shared switch, so
  // every boolean in every drawer reads the same.
  if (f.type === 'checkbox') return <Toggle checked={Boolean(v)} onChange={val => setF(f.key, val)} ariaLabel={typeof f.label === 'string' ? f.label : undefined} />
  // Every drawer picker is SEARCHABLE (Danny 28-07: "status/land/provincie is geen
  // zoekbare dropdown"). This one line covers status, land, provincie, branche en
  // vestiging on every entity that uses this table — a native <select> forces you to
  // scroll a 200-item country list. allowCreate stays off: these are tenant lookups,
  // adding a value belongs in Settings, not in a record's edit row.
  if (f.type === 'select') return <CreatableSelect value={(v as string) ?? ''} onChange={val => setF(f.key, val)} options={selectOptions(f.options)} placeholder={t('select')} allowCreate={false} style={compact}
    clearable={f.clearable} clearLabel={f.clearable && typeof f.label === 'string' ? f.label : undefined} />
  if (f.type === 'creatable') {
    // Lookup combobox that can also add a free-text value (tenant `allowCreate`).
    // KEY-ADOPTION: options may carry a `key` field; select by key when present,
    // else fall back to matching by name. Resolve and store the key on change.
    const opts = (f.options ?? []).map(o => {
      if (typeof o === 'string') return { value: o, label: o, key: null }
      return { value: o.value, label: String(o.label ?? o.value), key: (o as Record<string, unknown>).key ?? null }
    })
    // Find the current selected option: match by key first (if keyField exists), else by value.
    const keyField = `${f.key}Key` // e.g., 'source' → 'sourceKey'
    const keyValue = form[keyField] as string | null | undefined
    const selected = keyValue && opts.some(o => o.key === keyValue)
      ? opts.find(o => o.key === keyValue)
      : opts.find(o => o.value === v)
    // VAC-CLEAR-1: an optional creatable row is clearable when the config says so.
    return <CreatableSelect value={selected?.value ?? ''} onChange={val => {
      setF(f.key, val)
      // KEY-ADOPTION: resolve the picked option's key and store it alongside the name.
      // Always re-resolve: a free-typed value after a pick must drop the old key (the
      // backend ranks key above name, a stale key would silently save the previous row).
      const picked = opts.find(o => o.value === val)
      setF(keyField, picked?.key ?? null)
    }} options={opts} placeholder={t('select')} allowCreate={f.allowCreate !== false} style={compact}
      clearable={f.clearable} clearLabel={f.clearable && typeof f.label === 'string' ? f.label : undefined} />
  }
  if (f.type === 'date') return <DateField value={v as string | undefined} onChange={val => setF(f.key, val)} style={compact} />
  if (f.type === 'textarea') return <textarea value={(v as string) ?? ''} onChange={e => setF(f.key, e.target.value)} rows={3} style={{ ...compact, resize: 'vertical' }} />
  if (f.type === 'chips') {
    const arr = (Array.isArray(v) ? v : []).map(String)
    return <ChipMultiSelect options={f.chipOptions ?? []} selected={arr}
      onToggle={val => setF(f.key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])} />
  }
  // CONTACT-MULTI-1: a single-value coupling rendered as toggle chips (not a
  // plain <select>) so the field is visually ready for multi-value later — the
  // backend only supports one link today, so picking a chip REPLACES the value
  // (clicking the active chip clears it) rather than adding to a set.
  if (f.type === 'chip-select') {
    const cur = v as string | undefined
    const opts = f.chipOptions ?? []
    if (opts.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.emptyOptionsText ?? '—'}</span>
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {opts.map(o => {
          const active = cur === o.value
          const col = o.color ?? 'var(--color-primary)'
          return (
            <button key={o.value} type="button" onClick={() => setF(f.key, active ? '' : o.value)}
              // Interactive toggle chip — stays a real <button> (SoftChip has no
              // onClick), but the tint now uses the house tintBg/tintBorder formula
              // instead of hex-concat (§4, HUISSTIJL-1).
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chip toggle, not a Button (SoftChip has no onClick and Button has no chip/pill identity)
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                ...(active ? { background: tintBg(col, true), color: chipInk(col), border: tintBorder(col, true) } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }) }}>
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }
  if (f.type === 'richtext') {
    return <RichTextEditor value={(v as string) ?? ''} onChange={val => setF(f.key, val)}
      expanded={!!richExpanded[f.key]} onToggleExpand={() => setRichExpanded(p => ({ ...p, [f.key]: !p[f.key] }))} />
  }
  // Numbers/IDs render in mono (§4) — rates, cost codes, etc.
  return <input value={(v as string) ?? ''} type={f.inputType} step={f.step} onChange={e => setF(f.key, e.target.value)}
    style={f.mono ? { ...compact, ...monoStyle } : compact} />
}
