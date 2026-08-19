/**
 * Button — THE house button (HUISSTIJL-1, Danny 18-08: "geen 427 objecten voor
 * hetzelfde maar één herbruikbaar element, per tenant instelbaar"). Before this
 * component existed the app carried 1138 hand-styled <button> tags across 427
 * files with 565 distinct style signatures; the three variants below are the
 * de-facto styles those buttons already converged on (primary 162×, secondary
 * 131×, danger 90×), now written once.
 *
 * Tenant theming is free by construction: every colour is a token, and the
 * tokens are set per tenant from Settings → Company → Branding (stored in the
 * backend DB via the settings API, applied by useTenantTheme). A hardcoded
 * colour in here would break exactly that, so there are none.
 *
 * `size` maps the two real footprints found in the audit: 'md' = BTN_H/13px/r8
 * (pages, modals, drawers), 'sm' = 28px/12px/r6 (settings rows, dense panels).
 * Layout concerns (width, margins, flex) stay with the caller via `style` —
 * identity concerns (colour, chrome, typography) never do.
 */
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { BTN_H } from '@/config/buttonMetrics'
import { tintBg, tintBorder } from '@/lib/tint'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'dangerSoft'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  // Square icon button: fixed width = height, no horizontal padding.
  iconOnly?: boolean
}

// Identity per variant — colour/chrome only; sizing lives in SIZES.
const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  // The main action. on-accent is the contrast-safe text the theme derives for
  // whatever fill the tenant picked (clampedOnAccent) — never hardcoded white.
  primary:    { background: 'var(--button-fill)', color: 'var(--button-ink)', border: '1px solid var(--button-border)', fontWeight: 600 },
  // The calm sibling: cancel, back, everything that must not compete.
  secondary:  { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 500 },
  // Bare text button for inline/low-emphasis actions.
  ghost:      { background: 'none', color: 'var(--text-muted)', border: 'none', fontWeight: 500 },
  // PRIMAIR-VLAK-1 (Danny 19-08, on the tinted buttons app-wide: "alle knoppen
  // die licht rood zijn maken we tenantkleur"): the accent-tinted ACTION button
  // is retired — soft now paints the SOLID tenant fill, same as primary; only
  // the caller's chosen size differs. The variant name stays so its ~60 call
  // sites don't churn. Tints remain the language of CHIPS/toggles/filters
  // (status meaning), never of primary actions.
  soft:       { background: 'var(--button-fill)', color: 'var(--button-ink)', border: '1px solid var(--button-border)', fontWeight: 600 },
  // Destructive main action. --color-on-danger is fixed white (4.83:1, audited).
  danger:     { background: 'var(--color-danger)', color: 'var(--color-on-danger)', border: 'none', fontWeight: 600 },
  // Destructive but not the primary action of the surface (row deletes, etc.).
  dangerSoft: { background: tintBg('var(--color-danger)'), color: 'var(--color-danger)', border: tintBorder('var(--color-danger)'), fontWeight: 500 },
}

const SIZES: Record<ButtonSize, { height: number; padding: string; fontSize: number; borderRadius: number }> = {
  md: { height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8 },
  sm: { height: 28, padding: '0 10px', fontSize: 12, borderRadius: 6 },
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  // DEFAULT = sm (Danny 19-08: "drill downs moeten allemaal zelfde zijn — zelfde
  // geldt voor de instellingen"): ONE height everywhere, width follows the text.
  // md is the explicit exception for the page toolbar's "+ Nieuw" beside 34px
  // search chrome ("boven elke tabel groot mag").
  { variant = 'secondary', size = 'sm', iconOnly = false, disabled, style, type = 'button', children, ...rest }, ref,
) {
  const s = SIZES[size]
  return (
    <button ref={ref} type={type} disabled={disabled} {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        whiteSpace: 'nowrap', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        height: s.height, padding: iconOnly ? 0 : s.padding, fontSize: s.fontSize, borderRadius: s.borderRadius,
        ...(iconOnly ? { width: s.height } : {}),
        ...VARIANTS[variant],
        // Disabled keeps the shape but drops the claim to attention — one recipe,
        // instead of the per-file ternaries the audit found.
        ...(disabled ? { background: 'var(--border)', color: 'var(--text-muted)', border: 'none' } : {}),
        // Caller layout (width/margin/flex) may extend; identity props above win by order
        // only when the caller repeats them — which the §4 lint rule now flags anyway.
        ...style,
      }}>
      {children}
    </button>
  )
})

export default Button
