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
 *
 * `href` (HUISSTIJL slotaudit V7) is the polymorphic escape hatch: a link that
 * LOOKS like a button (mailto/tel/download) stays a real <a> semantically (§6 —
 * navigation is a link, not a button), but shares the exact same SIZES/VARIANTS
 * identity so it never drifts into its own inline-styled copy. `target="_blank"`
 * gets `rel="noopener noreferrer"` unless the caller already set `rel`.
 */
import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, Ref } from 'react'
import { BTN_H } from '@/config/buttonMetrics'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghostAccent' | 'soft' | 'danger' | 'dangerSoft'
export type ButtonSize = 'md' | 'sm'

// iconOnly REQUIRES an accessible name at the TYPE level (herhaal-audit r6
// A11Y-1..3: three icon-only delete buttons shipped with no name because their
// `title` was only filled in an edge case). A nameless icon button now fails
// `tsc --noEmit` instead of an audit — the error is impossible, not findable.
type IconOnlyNaming =
  | { iconOnly: true; 'aria-label': string }
  | { iconOnly?: false }

interface ButtonIdentityBase {
  variant?: ButtonVariant
  size?: ButtonSize
  // Shared across both the <button> and <a> renders — AnchorHTMLAttributes has
  // no native `disabled`, so the <a> branch honours it manually (see below).
  disabled?: boolean
}

// Type aliases (not interfaces): an interface cannot extend a union-carrying
// alias, and IconOnlyNaming is deliberately a union.
export type ButtonProps = ButtonIdentityBase & IconOnlyNaming &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }

// The <a> variant: same identity props, native anchor attributes, href required.
export type ButtonLinkProps = ButtonIdentityBase & IconOnlyNaming &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

// Identity per variant — colour/chrome only; sizing lives in SIZES.
const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  // The main action. on-accent is the contrast-safe text the theme derives for
  // whatever fill the tenant picked (clampedOnAccent) — never hardcoded white.
  primary:    { background: 'var(--button-fill)', color: 'var(--button-ink)', border: '1px solid var(--button-border)', fontWeight: 600 },
  // The calm sibling: cancel, back, everything that must not compete.
  secondary:  { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 500 },
  // Bare text button for inline/low-emphasis actions.
  ghost:      { background: 'none', color: 'var(--text-muted)', border: 'none', fontWeight: 500 },
  // Ghost with the ACCENT ink (contrast-safe text token): the bulk bars' deselect
  // action next to accent-inked count labels — declared here once, never via a
  // per-call-site style colour (§4: identiteit komt uit Button).
  ghostAccent: { background: 'none', color: 'var(--color-primary-text)', border: 'none', fontWeight: 500 },
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
  // A tinted variant never carries its source colour as ink: raw danger on its own
  // 10% tint measured 4.13:1 (< 4.5, herhaal-slotaudit 20-08) — chipInk blends it
  // toward --text far enough to read, in both themes.
  dangerSoft: { background: tintBg('var(--color-danger)'), color: chipInk('var(--color-danger)'), border: tintBorder('var(--color-danger)'), fontWeight: 500 },
}

const SIZES: Record<ButtonSize, { height: number; padding: string; fontSize: number; borderRadius: number }> = {
  md: { height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8 },
  sm: { height: 28, padding: '0 10px', fontSize: 12, borderRadius: 6 },
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps | ButtonLinkProps>(function Button(
  // DEFAULT = sm (Danny 19-08: "drill downs moeten allemaal zelfde zijn — zelfde
  // geldt voor de instellingen"): ONE height everywhere, width follows the text.
  // md is the explicit exception for the page toolbar's "+ Nieuw" beside 34px
  // search chrome ("boven elke tabel groot mag").
  { variant = 'secondary', size = 'sm', iconOnly = false, disabled, style, children, ...rest }, ref,
) {
  const s = SIZES[size]
  const identityStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    whiteSpace: 'nowrap', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
    height: s.height, padding: iconOnly ? 0 : s.padding, fontSize: s.fontSize, borderRadius: s.borderRadius,
    ...(iconOnly ? { width: s.height } : {}),
    ...VARIANTS[variant],
    // Caller layout (width/margin/flex) may extend the identity; the §4 lint rule
    // flags callers that repeat identity props.
    ...style,
    // Disabled keeps the shape but drops the claim to attention — one recipe, applied
    // AFTER the caller's style: a caller's state tint (e.g. a saved-green fill) must
    // never erase the only visual signal that the control is inert (Opus-review
    // slotaudit, 20-08: InUseCountsDialog lost its disabled look to a style spread).
    ...(disabled ? { background: 'var(--border)', color: 'var(--text-muted)', border: 'none', cursor: 'default' } : {}),
  }

  // href (HUISSTIJL slotaudit V7): a link that LOOKS like a button stays a real
  // <a> — mailto/tel/download is navigation, not an action (§6) — but renders
  // with the exact same SIZES/VARIANTS identity so it never grows its own
  // inline-styled copy. target="_blank" without an explicit rel gets the safe
  // noopener/noreferrer pair; a disabled link drops href/tabIndex/click instead
  // of a native `disabled` attribute, which <a> does not support.
  if ('href' in rest && rest.href !== undefined) {
    const { href, target, rel, onClick, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>
    const autoRel = target === '_blank' && !rel ? 'noopener noreferrer' : rel
    // Button's own <a> render IS the canonical href identity (HUISSTIJL slotaudit
    // V7) — the implementation the rule steers everyone else toward, not a copy of
    // it. Block form (not -next-line): the flagged style attribute sits several
    // lines into this opening tag, and a bare comment can't sit inside a JSX
    // attribute list.
    /* eslint-disable huisstijlLegacy/no-restricted-syntax */
    return (
      <a ref={ref as Ref<HTMLAnchorElement>} {...anchorRest}
        href={disabled ? undefined : href} target={target} rel={autoRel}
        aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? e => e.preventDefault() : onClick}
        style={identityStyle}>
        {children}
      </a>
    )
    /* eslint-enable huisstijlLegacy/no-restricted-syntax */
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    // Button's own <button> render IS the canonical style identity — not a copy.
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax
    <button ref={ref as Ref<HTMLButtonElement>} type={type} disabled={disabled} {...buttonRest} style={identityStyle}>
      {children}
    </button>
  )
})

export default Button
