/**
 * FilterValueControl — the edge-filter condition's VALUE control, picked by
 * operator/field instead of one bare text input (Danny 02-10, screenshot next
 * to Make.com: "de filters zijn ruk … datum is ook ruk"). The MAPPING of a
 * previous module's field into this value (Make's drag-in) is a separate lane
 * (FILTER-MAPPING-1); this component only replaces the typed syntax with real
 * controls while keeping the backend's wire format byte-identical.
 *
 * Wire formats (unchanged, the backend evaluator parses exactly these):
 *   - boolean field      -> a real boolean (true/false)
 *   - date_older_than_days / date_younger_than_days -> a day-count string ("30")
 *   - date_gte/gt/lte/lt  -> 'now', 'now-90d', 'now+2d', or a fixed 'YYYY-MM-DD'
 *   - in / not_in         -> a comma-separated string ("actief,verwijderd,extern"), or
 *                            the seeded ARRAY form; whichever form arrives is written back
 *   - everything else     -> the plain typed string
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import SelectMenu from '@/components/ui/SelectMenu'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'
import { isBooleanField, booleanValueKey, textValue, listValueItems } from './booleanField'

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
// RELATIVE-DATE-UNITS-1: weeks/months convert to days on save (×7, ×30) until the
// backend evaluator confirms other units — the wire only ever carries a day count.
const UNIT_TO_DAYS: Record<string, number> = { days: 1, weeks: 7, months: 30 }

// Parses the stored relative syntax ('now', 'now-90d', 'now+2d') back into the
// relative-mode fields. ALWAYS reads back as 'days' with the raw day count —
// never auto-promoted to weeks/months — so typing/picking never gets rewritten
// mid-edit (the bug: '30' parsed back as '1 month' and jumped the input).
function parseRelative(value: string): { direction: 'minus' | 'plus'; amount: number; unit: string } | null {
  const m = /^now(?:([+-])(\d+)d)?$/.exec(value)
  if (!m) return null
  if (!m[1]) return { direction: 'minus', amount: 0, unit: 'days' }
  const days = Number(m[2])
  const direction = m[1] === '-' ? 'minus' : 'plus'
  return { direction, amount: days, unit: 'days' }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface FilterValueControlProps {
  operator: string
  field?: string
  value: string | boolean | string[] | undefined
  onChange: (value: string | boolean | string[]) => void
  ariaLabel: string
}

// Picks the right value control for an operator/field combination — see the
// module doc above for the full wire-format table.
export default function FilterValueControl({ operator, field, value, onChange, ariaLabel }: FilterValueControlProps) {
  const { t } = useTranslation('workflows')
  const text = textValue(value)
  // Names the yes/no value menu below — SelectMenu's trigger is a <button>, not
  // labelable by a plain <label>, so a hidden span + aria-labelledby names it.
  const booleanLabelId = useId()
  // Names the two relative-date menus (direction, unit) below — same pattern.
  const directionLabelId = useId()
  const unitLabelId = useId()
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

  // List operators (in / not_in) — removable chips + a type-to-add input. The
  // engine reads a comma string and an array alike (FilterEvaluator::toList), the
  // seeds store arrays: the control reads both and writes back the FORM it received,
  // so an untouched shape never flips on edit (GET-shape == PUT-shape).
  if (LIST_OPERATORS.includes(operator)) {
    const items = listValueItems(value)
    const commit = (next: string[]) => onChange(Array.isArray(value) ? next : next.join(','))
    const addFromInput = (raw: string) => {
      const v = raw.trim()
      if (v && !items.includes(v)) commit([...items, v])
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {items.map((item, i) => (
            // CHIP-TINT-1 via the shared SoftChip atom — never a hand-rolled tint span.
            <SoftChip key={item + i} round color="var(--color-primary)" label={
              <>
                {item}
                <Button variant="ghost" size="sm" iconOnly aria-label={t('canvas.removeValue')}
                  onClick={() => commit(items.filter((_, j) => j !== i))}>
                  <X size={10} />
                </Button>
              </>
            } />
          ))}
          <input aria-label={ariaLabel} placeholder={t('fields.valuePlaceholder')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addFromInput((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
            onBlur={e => { addFromInput(e.target.value); e.target.value = '' }}
            style={{ flex: 1, minWidth: 80, padding: '4px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
        </div>
        <Caption>{t('canvas.listValuesHint')}</Caption>
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
      const days = amount * (UNIT_TO_DAYS[unit] ?? 1)
      if (days === 0) return 'now'
      return `now${direction === 'minus' ? '-' : '+'}${days}d`
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

  // Everything else — the plain text input, unchanged.
  return (
    <input value={text} onChange={e => onChange(e.target.value)}
      placeholder={t('fields.valuePlaceholder')} aria-label={ariaLabel}
      style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
  )
}
