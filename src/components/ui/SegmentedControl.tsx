/**
 * SegmentedControl — option-card group replacing hand-rolled radio buttons.
 * Renders as a `radiogroup` with roving-tabindex keyboard support (Left/Right/Up/Down
 * move + select, Home/End jump to first/last) so it behaves like a native radio group
 * for assistive tech while looking like the §4 soft-tint card set.
 *
 * §4 soft-tint: bg = color-mix(token 8-16%, transparent), text = token, border =
 * color-mix(token 28-50%, transparent); active adds fontWeight 600. No i18n inside —
 * labels/descriptions arrive already translated from the caller.
 */
import { useRef } from 'react'
import type { ComponentType, KeyboardEvent } from 'react'

export interface SegmentedControlOption {
  value: string
  label: string
  description?: string
  icon?: ComponentType<{ size?: number }>
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  // Semantic colour token (CSS var or hex) driving the soft-tint. Defaults to primary.
  color?: string
  // Accessible name for the radiogroup (required unless an external <label> already
  // labels it via aria-labelledby, which callers can add themselves).
  ariaLabel?: string
  // 'compact' (audit finding, 05-08): a small inline pill row — no icon/description,
  // no full-width cards — for a spot too tight for the default vertical option-card
  // layout (e.g. CvSectionList's per-row sidebar⇄main switch). Default unchanged.
  size?: 'default' | 'compact'
}

export default function SegmentedControl({ options, value, onChange, color = 'var(--color-primary)', ariaLabel, size = 'default' }: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const compact = size === 'compact'

  // Arrow/Home/End roving focus, mirroring native radiogroup keyboard behaviour —
  // moving focus also selects, exactly like radio inputs.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (index + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = options.length - 1
    if (nextIndex === null) return
    e.preventDefault()
    const next = options[nextIndex]
    onChange(next.value)
    refs.current[nextIndex]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 4 : 8 }}>
      {options.map((opt, i) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={active}
            ref={el => { refs.current[i] = el }}
            tabIndex={active || (!options.some(o => o.value === value) && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => onKeyDown(e, i)}
            style={compact ? {
              padding: '3px 9px', fontSize: 10.5, fontWeight: active ? 600 : 500, borderRadius: 999,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, color,
              background: `color-mix(in srgb, ${color} ${active ? 14 : 6}%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} ${active ? 45 : 20}%, transparent)`,
            } : {
              display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', width: '100%',
              color, fontWeight: active ? 600 : 500,
              background: `color-mix(in srgb, ${color} ${active ? 16 : 8}%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} ${active ? 50 : 28}%, transparent)`,
            }}>
            {compact ? opt.label : (
              <>
                {Icon && <Icon size={16} />}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13 }}>{opt.label}</span>
                  {opt.description && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{opt.description}</span>}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
