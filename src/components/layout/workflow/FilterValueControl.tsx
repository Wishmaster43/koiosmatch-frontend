/**
 * FilterValueControl — the edge-filter condition's VALUE control, picked by
 * operator/field instead of one bare text input (Danny 02-10, screenshot next
 * to Make.com: "de filters zijn ruk … datum is ook ruk"). FILTER-MAPPING-1
 * (same day: "actief,verwijderd,extern moeten mappingsvelden zijn van de
 * modules ervoor, zoals make.com dat ook heeft") adds Make's drag-a-field-in:
 * a "{ }" button maps a numbered upstream module's field into the value, and a
 * field with a known tenant vocabulary (`source`) swaps free typing for a
 * searchable lookup picker.
 *
 * Wire formats (unchanged, the backend evaluator parses exactly these):
 *   - boolean field      -> a real boolean (true/false)
 *   - date_older_than_days / date_younger_than_days -> a day-count string ("30")
 *   - date_gte/gt/lte/lt  -> 'now', 'now-90d', 'now-2w', 'now-3m', or a fixed 'YYYY-MM-DD'
 *   - in / not_in         -> a comma-separated string ("actief,verwijderd,extern"), or
 *                            the seeded ARRAY form; whichever form arrives is written back
 *   - a mapping token      -> '{{N.field}}' (filterValueToken), resolved by the
 *                            backend against the merged upstream bundle (ADDENDUM 2)
 *   - everything else     -> the plain typed string
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import SegmentedControl from '@/components/ui/SegmentedControl'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Caption } from '@/components/ui/typography'
import { isBooleanField, booleanValueKey, textValue, listValueItems } from './booleanField'
import ListValueEditor from './ListValueEditor'
import MappingPickerButton from './MappingPickerButton'
import { mappedValueLabel } from './mappedValueLabel'
import { lookupItemsForSource } from './lookupSourceTable'
import { useLookupsOptional } from '@/context/LookupsContext'
import type { WorkflowVarGroup } from '@/types/workflow'

// DATETIME-IMPORT-LES (CLAUDE.md §2): the shared `components/ui/NumberInput`
// imports `lib/formatters` -> `lib/datetime`, which has a real-i18n-init side
// effect — mounting it here would drag that init into every EdgeFilterPanel
// test (a suite that deliberately stays i18n-free, mirroring ScheduleModal's
// pattern). These day counts are small plain integers (no thousands separator
// ever applies), so a minimal local integer field avoids the transitive break
// instead of carrying it into a canon-protected test suite.
function DayCountInput({ value, onChange, ariaLabel, style }: {
  value: number | null; onChange: (n: number | null) => void; ariaLabel: string; style?: CSSProperties
}) {
  return (
    <input type="number" min={0} step={1} inputMode="numeric"
      value={value == null ? '' : String(value)} aria-label={ariaLabel}
      onChange={e => {
        const raw = e.target.value
        if (raw === '') { onChange(null); return }
        const n = Math.max(0, Math.round(Number(raw)))
        onChange(Number.isFinite(n) ? n : null)
      }}
      style={{ width: 70, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', ...style }} />
  )
}

const DAY_COUNT_OPERATORS = ['date_older_than_days', 'date_younger_than_days']
const LIST_OPERATORS = ['in', 'not_in']
const SINGLE_VALUE_OPERATORS = ['=', '!=']

// ADDENDUM 4 (CMBE confirmed): the relative-date unit stores NATIVELY as a
// 'd'/'w'/'m' suffix on the wire — no more ×7/×30 conversion to a day count.
const UNIT_SUFFIX: Record<string, string> = { days: 'd', weeks: 'w', months: 'm' }
const SUFFIX_UNIT: Record<string, string> = { d: 'days', w: 'weeks', m: 'months' }

// Parses the stored relative syntax ('now', 'now-90d', 'now-2w', 'now+3m')
// back into the relative-mode fields, reading the unit back AS STORED — never
// auto-promoted or converted — so typing/picking never gets rewritten mid-edit.
function parseRelative(value: string): { direction: 'minus' | 'plus'; amount: number; unit: string } | null {
  const m = /^now(?:([+-])(\d+)(d|w|m))?$/.exec(value)
  if (!m) return null
  if (!m[1]) return { direction: 'minus', amount: 0, unit: 'days' }
  const amount = Number(m[2])
  const unit = SUFFIX_UNIT[m[3]] ?? 'days'
  const direction = m[1] === '-' ? 'minus' : 'plus'
  return { direction, amount, unit }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface FilterValueControlProps {
  operator: string
  field?: string
  value: string | boolean | string[] | undefined
  onChange: (value: string | boolean | string[]) => void
  ariaLabel: string
  // FILTER-MAPPING-1: the numbered upstream-module field groups the "{ }"
  // mapping button offers — empty/omitted hides the button (no upstream chain).
  variables?: WorkflowVarGroup[]
  // The current FIELD's declared tenant-lookup source (filterFieldCatalog's
  // FilterFieldOption.source) — present only once the backend catalogue names
  // one; drives the known-vocabulary picker for =/!=/in/not_in.
  source?: string
}

// Picks the right value control for an operator/field combination — see the
// module doc above for the full wire-format table.
export default function FilterValueControl({ operator, field, value, onChange, ariaLabel, variables = [], source }: FilterValueControlProps) {
  const { t } = useTranslation('workflows')
  const text = textValue(value)
  // Names the yes/no value menu below — SelectMenu's trigger is a <button>, not
  // labelable by a plain <label>, so a hidden span + aria-labelledby names it.
  const booleanLabelId = useId()
  // Names the two relative-date menus (direction, unit) below — same pattern.
  const directionLabelId = useId()
  const unitLabelId = useId()
  // Names the known-vocabulary single-value picker (=/!= with a source) below.
  const sourceLabelId = useId()
  // FILTER-MAPPING-1: the current field's lookup, when its catalogue entry
  // declares a `source` — null when there is none, falling back to free chips.
  const lookups = useLookupsOptional()
  const sourceItems = lookups
    ? lookupItemsForSource(source, { statuses: lookups.statuses, phases: lookups.phases, candidateTypes: lookups.candidateTypes, funnelTypes: lookups.funnelTypes })
    : null
  // Relative-date fields (direction/amount/unit) are component STATE, seeded
  // ONCE from the wire value — never recomputed from `text` on every render.
  // Recomputing from the serialised string was the bug: it round-tripped exact
  // multiples of 7/30 up to weeks/months mid-typing ("30" days jumped to "1
  // month"), and an amount of 0 collapsed to the bare 'now' string, which loses
  // the chosen direction/unit on the next render.
  const [relativeState, setRelativeState] = useState(
    () => parseRelative(text) ?? { direction: 'minus' as const, amount: 0, unit: 'days' },
  )
  // Lens 2 (02-10): the panel keys its condition rows by index, so after a delete
  // this control can receive ANOTHER condition's wire value. Resync the local
  // relative state whenever the incoming value is not the one this control wrote
  // itself (the ref is written in the handlers/effect only, REFS-IN-EFFECTS-1).
  const lastWrittenRef = useRef<string | null>(null)
  useEffect(() => {
    if (text === lastWrittenRef.current) return
    const parsed = parseRelative(text)
    if (parsed) setRelativeState(parsed)
  }, [text])

  // Boolean field — unchanged yes/no menu, moved in from EdgeFilterPanel.
  if (isBooleanField(field)) {
    return (
      <>
        <span id={booleanLabelId} hidden>{ariaLabel}</span>
        {/* DROPDOWN-CLEAR-1: a yes/no condition has no empty state — dropping the
            condition is the row's own delete button, so the clear stays off. */}
        {/* Fills the row like the old EdgeFilterPanel branch — SelectMenu's
            trigger is width:100% of its parent, so it needs a flex:1 wrapper. */}
        <div style={{ flex: 1 }}>
          <SelectMenu aria-labelledby={booleanLabelId} value={booleanValueKey(value)} clearable={false}
            options={[{ value: 'true', label: t('common:yes') }, { value: 'false', label: t('common:no') }]}
            onChange={v => onChange(v === 'true')} />
        </div>
      </>
    )
  }

  // Day-count operators — a plain number of days, stored as a string.
  if (DAY_COUNT_OPERATORS.includes(operator)) {
    const n = text === '' ? null : Number(text)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <DayCountInput value={Number.isFinite(n) ? n : null}
          onChange={v => onChange(v == null ? '' : String(v))} ariaLabel={ariaLabel} />
        <Caption>{t('canvas.unitDays')}</Caption>
      </div>
    )
  }

  // List operators (in / not_in) — removable chips + a type-to-add input (or,
  // with a known vocabulary, a searchable lookup picker instead of free typing)
  // plus the "{ }" mapping button. The engine reads a comma string and an array
  // alike (FilterEvaluator::toList), the seeds store arrays: the control reads
  // both and writes back the FORM it received (GET-shape == PUT-shape).
  if (LIST_OPERATORS.includes(operator)) {
    const items = listValueItems(value)
    const commit = (next: string[]) => onChange(Array.isArray(value) ? next : next.join(','))
    const addItem = (raw: string) => {
      const v = raw.trim()
      if (v && !items.includes(v)) commit([...items, v])
    }
    const renderAdd = sourceItems
      ? (addFromInput: (v: string) => void) => (
          <div style={{ minWidth: 150, flex: 1 }}>
            {/* DROPDOWN-CLEAR-1: this is a stateless "add another chip" picker, never a
                saved value of its own — it always starts unset, so a clear affordance
                would have nothing to clear. */}
            <CreatableSelect value={undefined} allowCreate={false} clearable={false}
              options={sourceItems.map(i => ({ value: i.value, label: i.label }))}
              placeholder={t('fields.valuePlaceholder')} onChange={addFromInput} menuWidth={220}
              style={{ padding: '4px 6px', fontSize: 12, borderRadius: 6 }} />
          </div>
        )
      : undefined
    return (
      <ListValueEditor items={items} onCommit={commit} ariaLabel={ariaLabel} renderAdd={renderAdd}
        describeItem={item => mappedValueLabel(item, variables) ?? sourceItems?.find(i => i.value === item)?.label ?? null}>
        <MappingPickerButton variables={variables} onInsert={f => addItem(f.token)} />
      </ListValueEditor>
    )
  }

  // =/!= on a field with a known vocabulary — one searchable lookup value
  // instead of free text, plus the "{ }" mapping button beside it.
  if (sourceItems && SINGLE_VALUE_OPERATORS.includes(operator)) {
    return (
      <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
        <span id={sourceLabelId} hidden>{ariaLabel}</span>
        <div style={{ flex: 1 }}>
          <CreatableSelect aria-labelledby={sourceLabelId} value={text || undefined} allowCreate={false}
            options={sourceItems.map(i => ({ value: i.value, label: i.label }))}
            placeholder={t('fields.valuePlaceholder')} onChange={onChange} />
        </div>
        <MappingPickerButton variables={variables} onInsert={f => onChange(f.token)} />
      </div>
    )
  }

  // Other date_* operators — fixed date vs relative-to-now, via a mode switch.
  if (operator.startsWith('date_')) {
    const mode = parseRelative(text) ? 'relative' : 'fixed'
    const fixedValue = ISO_DATE.test(text) ? text : ''
    const modeOptions = [
      { value: 'fixed', label: t('canvas.dateModeFixed') },
      { value: 'relative', label: t('canvas.dateModeRelative') },
    ]
    const toRelativeString = (direction: string, amount: number, unit: string) => {
      if (amount === 0) return 'now'
      const suffix = UNIT_SUFFIX[unit] ?? 'd'
      return `now${direction === 'minus' ? '-' : '+'}${amount}${suffix}`
    }
    // Writes the local relative state AND the wire value together, so the
    // chosen direction/amount/unit survives even when it serialises to the
    // bare 'now' (amount 0) — the next render reads the state, not the string.
    const writeRelative = (next: { direction: 'minus' | 'plus'; amount: number; unit: string }) => {
      const wire = toRelativeString(next.direction, next.amount, next.unit)
      lastWrittenRef.current = wire
      setRelativeState(next)
      onChange(wire)
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <SegmentedControl size="compact" options={modeOptions} value={mode}
          ariaLabel={ariaLabel}
          onChange={m => { const wire = m === 'relative' ? toRelativeString(relativeState.direction, relativeState.amount, relativeState.unit) : ''; lastWrittenRef.current = wire; onChange(wire) }} />
        {mode === 'fixed' ? (
          // DATUM-1: the ONE allowed native date control — the browser paints it.
          <input type="date" value={fixedValue} aria-label={ariaLabel}
            onChange={e => onChange(e.target.value)}
            style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Caption>{t('canvas.relativeNow')}</Caption>
            <span id={directionLabelId} hidden>{t('fields.operator')}</span>
            {/* DROPDOWN-CLEAR-1: a relative-date direction always has a value (defaults to
                "minus") — an empty direction cannot serialize into the now±Nd syntax. */}
            <SelectMenu aria-labelledby={directionLabelId} clearable={false} value={relativeState.direction} menuWidth={100}
              options={[{ value: 'minus', label: t('canvas.relativeMinus') }, { value: 'plus', label: t('canvas.relativePlus') }]}
              onChange={d => writeRelative({ ...relativeState, direction: d as 'minus' | 'plus' })} />
            <DayCountInput value={relativeState.amount}
              ariaLabel={ariaLabel} onChange={n => writeRelative({ ...relativeState, amount: n ?? 0 })} />
            <span id={unitLabelId} hidden>{t('canvas.unitDays')}</span>
            {/* DROPDOWN-CLEAR-1: the unit always has a value (defaults to "days") — an
                empty unit cannot serialize a day count into the now±Nd syntax. */}
            <SelectMenu aria-labelledby={unitLabelId} clearable={false} value={relativeState.unit} menuWidth={110}
              options={[
                { value: 'days', label: t('canvas.unitDays') },
                { value: 'weeks', label: t('canvas.unitWeeks') },
                { value: 'months', label: t('canvas.unitMonths') },
              ]}
              onChange={u => writeRelative({ ...relativeState, unit: u })} />
          </div>
        )}
      </div>
    )
  }

  // Everything else — the plain text input, plus the "{ }" mapping button.
  return (
    <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
      <input value={text} onChange={e => onChange(e.target.value)}
        placeholder={t('fields.valuePlaceholder')} aria-label={ariaLabel}
        style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
      <MappingPickerButton variables={variables} onInsert={f => onChange(text + f.token)} />
    </div>
  )
}
