import ChipMultiSelect from '@/components/ui/ChipMultiSelect'

/**
 * LookupChipSelect — the ONE shared block for "select which lookup values count"
 * (vacancy statuses / deployability statuses / contract forms / phases / …).
 * Wires a tenant lookup list (with its own `color`) onto the shared
 * `ChipMultiSelect`, with an optional label + hint row above it — replaces the
 * duplicated raw-checkbox `LookupCheckboxBlock` that used to live inline in
 * VacancyCandidateTabSettings and CandidateVacancyTabSettings (house idiom,
 * Danny: "checkbox? wij gebruiken toch toggles?").
 */
export default function LookupChipSelect({ label, hint, items, selected, onToggle, color, emptyText, ariaLabel }) {
  // Lookup rows arrive as { value, label, color } — map straight onto ChipMultiSelect's option shape.
  const options = items.map(it => ({ value: it.value, label: it.label, color: it.color }))
  return (
    <div>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
          {label}
        </label>
      )}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{hint}</p>}
      <ChipMultiSelect options={options} values={selected} onToggle={onToggle} color={color} emptyText={emptyText} ariaLabel={ariaLabel ?? label} />
    </div>
  )
}
