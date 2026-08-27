/**
 * TitleBarPills — the ONE shared pill row for the short choice at the top of a
 * create popup's title bar (TITELBALK-PILLS, Danny 27-08: he saw two different
 * styles — AddCandidateModal's Lead/Candidate QuickViewToggle pair vs
 * AddVacancyModal's hand-rolled status pills with colour dots — and wants one
 * atom both modals (and every future one) read.
 *
 * Single-value choice, CHIP-TINT-1 recipe (lib/tint): inactive = a subtle tint
 * of the option's own colour (or the neutral border when no colour is given),
 * active = the 16/50 tint + `chipInk` text + fontWeight 600. A leading colour
 * DOT renders only when the option itself carries a colour (the vacancy-status
 * look) — a colourless choice (candidate phase, task type without a lookup
 * colour) never fakes one. `clearable` lets re-clicking the active pill clear
 * the value (VAC-CLEAR-1, only for genuinely optional fields — e.g. the match
 * Contractvorm pills); omit it for a required field, where the active pill
 * always stays picked.
 */
import { BTN_H } from '@/config/buttonMetrics'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

export interface TitleBarPillOption {
  value: string
  label: string
  // Semantic colour (CSS var or hex/token). Renders a leading dot when present.
  color?: string
}

interface TitleBarPillsProps {
  options: TitleBarPillOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  // Re-clicking the active pill clears the value — only for optional fields.
  clearable?: boolean
  // Validation message rendered under the row (danger-text ink, aria-live) —
  // the title bar has no FormField wrapper, so the atom owns its own error line.
  error?: string | null
}

// The one title-bar pill row: a read-and-pick control, never a form field.
export default function TitleBarPills({ options, value, onChange, ariaLabel, clearable = false, error = null }: TitleBarPillsProps) {
  if (options.length === 0) return null
  return (
    <div>
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value
        const c = o.color ?? 'var(--border)'
        return (
          <button key={o.value} type="button" title={o.label} aria-pressed={active}
            onClick={() => onChange(clearable && active ? '' : o.value)}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- state-carrying choice pill: fill/border encode the option's own semantic colour, per option, which Button's fixed variant palette cannot express
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: BTN_H, padding: '0 14px',
              borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
              border: tintBorder(c, active),
              background: tintBg(c, active) }}>
            {o.color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? chipInk(c) : 'var(--text)' }}>
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
    {error && (
      <div aria-live="polite" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>{error}</div>
    )}
    </div>
  )
}
