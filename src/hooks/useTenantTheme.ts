/**
 * useTenantTheme — applies the tenant's brand colour (Settings → Branding, `brand_color`)
 * to the CSS design tokens at runtime. This is the missing half of BrandSettings: the
 * form saved the colour but nothing ever read it, so picking a house style did nothing
 * (2026-07-03 audit #7). Components keep reading var(--color-primary) — zero changes there;
 * a new tenant brand = new variables (§4). Derived light/bg shades use color-mix so they
 * work in both light and dark themes. No brand_color set → the index.css defaults stay.
 */
import { useEffect } from 'react'
import { useAllSettings } from '@/lib/settings/useAllSettings'

// Loose hex check — only apply a real colour, never arbitrary strings into CSS.
const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

/** WCAG relative luminance of a #rrggbb colour (sRGB channels linearised first). */
function luminanceOf(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminanceOf(a), lb = luminanceOf(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Readable text colour for a background — picks whichever of near-black/white
 * actually CONTRASTS MORE, instead of guessing from a luminance threshold.
 * Measured 08-08 why that matters: the Yesway orange (#F97316) sits just under a
 * 0.45 threshold, so the old rule kept WHITE text at ratio 2.8 (unreadable, Danny:
 * "rode vlak is niet te lezen" — "red area is not readable") while near-black
 * scores ~7.4 on the same fill.
 * Comparing the two real ratios has no threshold to tune and is right for every hue.
 */
export function readableOn(hex: string): string {
  const bg = luminanceOf(hex)
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  const dark = '#1F2937'
  return ratio(bg, luminanceOf(dark)) >= ratio(bg, 1) ? dark : '#FFFFFF'
}

// Channel-wise blend of two #rrggbb colours; `amount` is how much of `a` remains.
function mixHex(a: string, b: string, amount: number): string {
  const parse = (h: string) => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16))
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const ch = (x: number, y: number) => Math.round(x * amount + y * (1 - amount))
  return `#${[ch(ar, br), ch(ag, bg), ch(ab, bb)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The brand used AS TEXT on a surface, darkened (or lightened) just enough to clear
 * WCAG AA — and no further.
 *
 * Two lessons are baked in here, both from Danny's own eyes. First: a raw light brand
 * is unreadable as text (Yesway's orange scores 3.07:1 on white, AENF's yellow 1.34:1),
 * so it must be adjusted. Second (09-08, "kleuren zijn anders"): the first fix mixed
 * toward #111827, a BLUE-black, which dragged the orange to a muddy maroon AND
 * overshot to 6.4:1. Mixing toward pure black/white keeps the hue, and stepping until
 * the ratio is merely MET keeps the colour as close to the brand as the rule allows.
 *
 * A fixed ratio cannot work across hues — 75% brand + black clears AA for orange
 * (5.12:1) but leaves yellow at 2.42:1 — which is exactly why this steps instead.
 *
 * Third lesson (09-08, "vacature naam niet te lezen" — "vacancy name not
 * readable", twice): aiming at exactly 4.5
 * landed the vacancy link on 4.58:1 and Danny still could not read it comfortably.
 * 4.5 is the floor for LEGIBLE, not for comfortable, and a link is scanned in a
 * dense list rather than read as prose. The default target is now 5.5 — a
 * deliberate margin above the minimum instead of sitting on it — which keeps the
 * hue recognisable while stepping the orange from #cc4a2e to #b24028. When a real
 * user says twice that they cannot read it, the formula is wrong, not the user.
 */
const ACCENT_TEXT_TARGET = 5.5

export function readableAccentText(brand: string, surface: string, target = ACCENT_TEXT_TARGET): string {
  if (contrastRatio(brand, surface) >= target) return brand
  // Move AWAY from the surface: darken on a light one, lighten on a dark one.
  const toward = luminanceOf(surface) > 0.5 ? '#000000' : '#FFFFFF'
  // 2% steps (was 5%): a finer walk stops just past the target instead of
  // overshooting it, which is what kept the brand hue recognisable in the first place.
  for (let keep = 0.98; keep > 0; keep -= 0.02) {
    const candidate = mixHex(brand, toward, keep)
    if (contrastRatio(candidate, surface) >= target) return candidate
  }
  return toward
}

// WCAG AA floor for the on-accent fill — the button LABEL must clear this
// against whatever the accent fill actually is (brand, or the CSS default).
// Two WCAG bars, deliberately (Danny 13-08, "oranje en wit past wel — kijk op
// yesway.nu" — "orange and white does work — look at yesway.nu"): 4.5:1 is the
// bar for NORMAL text (1.4.3), but button labels and
// chips on an accent fill are large/bold UI-component text, where WCAG sets the
// bar at 3:1 (1.4.3 large text / 1.4.11 non-text). White on Yesway orange
// measures 3.1 — a real, working brand identity that a 4.5 clamp wrongly
// overrode. So: an EXPLICIT tenant pick is honoured from 3:1 up; only truly
// unreadable combos (white on AENF yellow ≈ 1.7) are still corrected. The
// AUTOMATIC mode keeps aiming for the best contrast via readableOn.
const ON_ACCENT_EXPLICIT_FLOOR = 3.0

/**
 * The on-accent colour to actually use: an explicit pick wins, but only when it
 * is readable on `bg` — otherwise it silently falls back to the derived
 * black/white choice (P2-clamp, Danny 13-08). This is a CLAMP, not a rejection:
 * the tenant's pick still applies whenever it clears AA, so a deliberately
 * bold-but-legible choice is never overridden.
 */
export function clampedOnAccent(explicit: string | null | undefined, bg: string): string {
  if (isHexColor(explicit) && contrastRatio(explicit, bg) >= ON_ACCENT_EXPLICIT_FLOOR) return explicit
  return readableOn(bg)
}

/**
 * Sets the FULL brand token set on <html> — primary/-light/-bg/-text/on-accent —
 * from one place, so the live Branding preview and the runtime hook can never
 * drift into applying a partial subset (P2a, Danny 13-08: the preview used to
 * only touch primary+on-accent, leaving -light/-bg/-text stale until reload).
 */
export function applyBrandTokens(brand: string | null | undefined, brandText: string | null | undefined): void {
  const root = document.documentElement
  if (isHexColor(brand)) {
    root.style.setProperty('--color-primary', brand)
    root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${brand} 70%, white)`)
    root.style.setProperty('--color-primary-bg', `color-mix(in srgb, ${brand} 12%, transparent)`)
    // Text ON the accent (button labels, chips): explicit pick if it clears AA
    // on this brand fill, else the higher-contrast of near-black/white.
    root.style.setProperty('--color-on-accent', clampedOnAccent(brandText, brand))
    // Accent used AS text (active menu item, tabs, links): a light brand fades
    // into a light surface, a darkened one fades into the dark theme — mix
    // toward whichever direction this theme needs, and only when needed.
    const darkMode = root.getAttribute('data-theme') === 'dark'
      || (!root.getAttribute('data-theme') && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    const surface = darkMode ? '#13131F' : '#FFFFFF'
    root.style.setProperty('--color-primary-text', readableAccentText(brand, surface))
  } else {
    // No (valid) tenant brand → the index.css defaults stay.
    root.style.removeProperty('--color-primary')
    root.style.removeProperty('--color-primary-light')
    root.style.removeProperty('--color-primary-bg')
    root.style.removeProperty('--color-primary-text')
    // An explicit text colour still applies without a brand colour — clamped
    // against the CSS default fill (read back after the removeProperty above),
    // the same rule as the branded path, so a stray white-on-white can't happen.
    if (isHexColor(brandText)) {
      const defaultBg = getComputedStyle(root).getPropertyValue('--color-primary').trim()
      root.style.setProperty('--color-on-accent', isHexColor(defaultBg) ? clampedOnAccent(brandText, defaultBg) : brandText)
    } else {
      root.style.removeProperty('--color-on-accent')
    }
  }
}

export function useTenantTheme(tenant?: { primary_color?: string | null; text_color?: string | null } | null): void {
  const settings = useAllSettings()
  // The Branding form saves settings.brand_color; some tenant payloads carry
  // primary_color. Read both — the tenant-facing Branding setting wins.
  const brand = (settings?.brand_color as string | undefined) ?? tenant?.primary_color
  // BRAND-TEXT-COLOR-1 (Danny 08-08 "als ik geel kies moet de txt niet wit zijn" —
  // "if I pick yellow the text shouldn't be white"): the text ON the accent is its
  // own token. Explicit pick wins (Branding form, or
  // tenant.text_color from /auth/me); otherwise it is derived from real contrast.
  const brandText = (settings?.brand_text_color as string | undefined) ?? tenant?.text_color ?? undefined

  useEffect(() => {
    const root = document.documentElement

    // THEME-REACTIVE (Danny 08-08 "als ik nu dark of light theme kies moet het ook
    // nog werken" — "if I now pick dark or light theme it still has to work"): the
    // readable accent depends on the SURFACE it sits on, so this
    // recomputes on a theme flip too — not only when the brand changes.
    const apply = () => applyBrandTokens(brand, brandText)

    apply()
    // Theme changes two ways: the app stamps data-theme on <html>, or the OS
    // preference flips while the app follows the system. Watch both.
    const observer = new MutationObserver(apply)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener?.('change', apply)

    // Reset on unmount (logout unmounts the layout) so the next tenant starts clean.
    return () => {
      observer.disconnect()
      media?.removeEventListener?.('change', apply)
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-light')
      root.style.removeProperty('--color-primary-bg')
      root.style.removeProperty('--color-primary-text')
      root.style.removeProperty('--color-on-accent')
    }
  }, [brand, brandText])
}
