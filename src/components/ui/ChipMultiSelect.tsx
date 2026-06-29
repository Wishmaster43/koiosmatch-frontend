/**
 * ChipMultiSelect — a row of toggle chips for a multi-value field (preferred days,
 * industries, driving licences, …). Styled like the candidate-type chips but with
 * the neutral primary accent (these options carry no per-item colour). Selecting
 * toggles membership. Generic dumb UI — no feature logic.
 */
export interface ChipOption { value: string; label: string }

interface ChipMultiSelectProps {
  options: ChipOption[]
  selected: string[]
  onToggle: (value: string) => void
  emptyText?: string
}

export default function ChipMultiSelect({ options, selected, onToggle, emptyText }: ChipMultiSelectProps) {
  if (options.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? '—'}</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)}
            style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              fontWeight: active ? 600 : 400,
              background: active ? 'var(--color-primary-bg)' : 'var(--surface)',
              color: active ? 'var(--color-primary)' : 'var(--text-muted)',
              border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`, transition: 'all 0.12s' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
