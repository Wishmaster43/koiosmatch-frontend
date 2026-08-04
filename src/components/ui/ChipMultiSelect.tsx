/**
 * ChipMultiSelect — soft-chip multiselect (decision Danny 04-08), replacing raw
 * checkbox lookup-selection (preferred days, industries, driving licences, locations, …).
 * Each chip uses the exact QuickViewToggle §4 soft-tint recipe (color-mix on the chip's
 * own colour — works for both hex AND `var(--color-*)` tokens, unlike the old hex-suffix
 * trick this replaces): inactive still carries an 8% tint, active is a 16% tint +
 * fontWeight 600. Generic dumb UI — no feature logic, no i18n inside.
 *
 * `values`/`onValuesToggle` is the current prop API (task spec); `selected` is kept as
 * an accepted alias so the existing call sites (RolesSettings, EditUserModal, AgentForm,
 * EditableFieldTable, …) keep working unchanged — pass either.
 */
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
}

export default function ChipMultiSelect({ options, values, selected, onToggle, color = 'var(--color-primary)', emptyText, ariaLabel }: ChipMultiSelectProps) {
  const active = values ?? selected ?? []
  if (options.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? '—'}</span>
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => {
        const isActive = active.includes(o.value)
        const tint = o.color ?? color
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)} aria-pressed={isActive}
            style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              fontWeight: isActive ? 600 : 500, color: tint,
              background: `color-mix(in srgb, ${tint} ${isActive ? 16 : 8}%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tint} ${isActive ? 50 : 28}%, transparent)`,
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
