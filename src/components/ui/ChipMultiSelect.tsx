/**
 * ChipMultiSelect — soft-chip multiselect (decision Danny 04-08), replacing raw
 * checkbox lookup-selection (preferred days, industries, driving licences, locations, …).
 *
 * CHIP-CONTRAST-1 (Danny 05-08: "je ziet niet duidelijk welke gekozen zijn" — "you
 * can't clearly see which ones are chosen"): in a SELECTION context every option
 * carrying its own tint made chosen vs unchosen a colour-nuance guessing game —
 * and colour was the ONLY signal (§6 violation). Now:
 * unchosen = neutral (muted text, plain border, no tint); chosen = the §4 soft tint
 * + fontWeight 600 + a check mark, so the state reads at a glance and without colour.
 * The §4 recipe stays intact for chosen chips (color-mix works for hex AND tokens).
 * Generic dumb UI — no feature logic, no i18n inside.
 *
 * `values`/`onValuesToggle` is the current prop API (task spec); `selected` is kept as
 * an accepted alias so the existing call sites (RolesSettings, EditUserModal, AgentForm,
 * EditableFieldTable, …) keep working unchanged — pass either.
 */
import { Check } from 'lucide-react'
import SelectAllRow from './SelectAllRow'
import { useBatchToggle } from '@/hooks/useBatchToggle'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

export interface ChipOption { value: string; label: string; color?: string }

interface ChipMultiSelectProps {
  options: ChipOption[]
  // Preferred prop name (task spec). `selected` is the legacy alias, still accepted.
  values?: string[]
  selected?: string[]
  onToggle: (value: string) => void
  color?: string
  emptyText?: string
  ariaLabel?: string
  // "Select all / clear all" above the chips (Danny punt 7). On by default: this
  // control is multi-select by definition, and its longest lists (branches,
  // locations, industries) are exactly where ticking one by one hurts. Suppressed
  // for a one-option list, where the action would be pure noise.
  selectAll?: boolean
}

export default function ChipMultiSelect({ options, values, selected, onToggle, color = 'var(--color-primary)', emptyText, ariaLabel, selectAll = true }: ChipMultiSelectProps) {
  const active = values ?? selected ?? []
  // Hooks run before any early return — the batch is applied one value per commit
  // because call sites hand us a per-value onToggle (see useBatchToggle).
  const applyBatch = useBatchToggle<string>(onToggle)
  if (options.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? '—'}</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {selectAll && options.length > 1 && (
        <SelectAllRow dense visibleValues={options.map(o => o.value)} selectedValues={active}
          onApply={batch => applyBatch(batch)} />
      )}
      <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => {
        const isActive = active.includes(o.value)
        const tint = o.color ?? color
        // This IS the shared chip-multiselect's own canonical chip render (an
        // aria-pressed choice-chip, a different species than Button), not a copy.
        // Block form: the flagged style attribute sits lines into the opening tag.
        /* eslint-disable huisstijlLegacy/no-restricted-syntax */
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)} aria-pressed={isActive}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              // Chosen: §4 soft tint + weight + check. Unchosen: neutral — no tint at
              // all, so the chosen state is unmistakable (and never colour-only, §6).
              fontWeight: isActive ? 600 : 400,
              // CHIP-TINT-1 (Danny 20-08, screenshot of the preference chips:
              // "het oranje is te krachtig — de chips doen we in dat lichte rode,
              // en dit geldt voor alle chips" — "the orange is too strong — we'll
              // do the chips in that light red, and this applies to all chips"):
              // supersedes the 19-08 solid order
              // FOR CHIPS ONLY — selected choice-chips wear the active 16/50 tint
              // with chipInk (readable on its own tint since r3); buttons, action
              // bars and toolbar toggles keep the solid trio.
              color: isActive ? chipInk(tint) : 'var(--text-muted)',
              background: isActive ? tintBg(tint, true) : 'var(--bg)',
              border: isActive ? tintBorder(tint, true) : '1px solid var(--border)',
            }}>
            {isActive && <Check size={11} strokeWidth={3} aria-hidden="true" />}
            {o.label}
          </button>
        )
        /* eslint-enable huisstijlLegacy/no-restricted-syntax */
      })}
      </div>
    </div>
  )
}
