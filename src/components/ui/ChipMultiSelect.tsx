/**
 * ChipMultiSelect — a row of toggle chips for a multi-value field (preferred days,
 * industries, driving licences, …). Styled like the candidate-type chips but with
 * the neutral primary accent (these options carry no per-item colour). Selecting
 * toggles membership. Generic dumb UI — no feature logic.
 */
export interface ChipOption { value: string; label: string; color?: string }

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
        const col = o.color
        // Active chip: per-value colour when set (e.g. contract forms), else primary accent.
        const activeStyle = col
          ? { background: col + '1A', color: col, border: `1px solid ${col}55` }
          : { background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)}
            style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.12s',
              ...(active ? activeStyle : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }) }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
