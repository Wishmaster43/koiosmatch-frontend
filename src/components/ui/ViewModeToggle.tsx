/**
 * ViewModeToggle — shared icon-only view switcher (table/board/…) for list pages.
 * Replaces three hand-copied icon-button pairs (Applications/Matches/Tasks) that
 * used a solid primary fill on the active option — the exact drift §4 forbids.
 * Mirrors the QuickViewToggle soft-tint formula (color-mix 8/16% bg, 28/50% border)
 * so every view switcher reads as the same component, one look, forever.
 * Generic over the view-id string union so callers keep their own narrow type
 * (e.g. 'table' | 'board') instead of widening to a plain string.
 */
import type { ComponentType } from 'react'

export interface ViewModeOption<T extends string = string> {
  id: T
  icon: ComponentType<{ size?: number }>
  label: string
}

interface ViewModeToggleProps<T extends string = string> {
  value: T
  onChange: (id: T) => void
  options: ViewModeOption<T>[]
  // Semantic colour token driving the soft tint; defaults to the primary accent.
  color?: string
}

export default function ViewModeToggle<T extends string = string>({ value, onChange, options, color = 'var(--color-primary)' }: ViewModeToggleProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(({ id, icon: Icon, label }) => {
        const active = value === id
        return (
          <button key={id} onClick={() => onChange(id)} title={label} aria-label={label} aria-pressed={active}
            style={{
              display: 'flex', padding: 6, borderRadius: 6, cursor: 'pointer', color: active ? color : 'var(--text-muted)',
              background: `color-mix(in srgb, ${color} ${active ? 16 : 8}%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} ${active ? 50 : 28}%, transparent)`,
            }}>
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
