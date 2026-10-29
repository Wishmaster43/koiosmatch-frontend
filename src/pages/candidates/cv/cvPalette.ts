/**
 * cvPalette — the per-region colour palette of the CV's movable sections. Pdf-free on
 * purpose (no @react-pdf import) so the Settings HTML preview can use it without
 * pulling the PDF engine into its chunk; cvStyles re-exports it for the PDF side.
 */
import { readableOn } from '@/hooks/useTenantTheme'

// Hex + alpha -> rgba(): react-pdf takes literal colour values (no color-mix/CSS
// vars here, see paletteFor below), so translucent sidebar text/chip tints are built from
// the computed on-accent hex rather than a fixed rgba(255,255,255,x) constant.
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Colour palette for a MOVABLE section's content, keyed by the region it lands
// in: the sidebar sits on the solid accent-colour background (light text/chips),
// the main column is plain white — chips there use the house soft-chip
// convention (§4: tinted background, coloured text) so a tenant-relocated
// section always stays legible regardless of which region it ends up in.
export interface Palette { label: string; text: string; chipBg: string; chipText: string; bulletColor: string }
// `sidebarColor` is the sidebar's own background (the tenant accent) — required
// for the 'sidebar' region so its text/chip colours can be derived the same
// readable-luminance way as makeStyles in cvStyles, instead of a hardcoded white.
export function paletteFor(region: 'sidebar' | 'main', color2: string, sidebarColor?: string): Palette {
  /* eslint-disable no-restricted-syntax, huisstijl/no-restricted-syntax -- PDF palette colours; react-pdf renders NO CSS color-mix and cannot resolve var(--color-*) tokens, and the colours are guaranteed hex, the ONE context where hex+alpha concat is safe (mirrors makeStyles in cvStyles) */
  if (region === 'sidebar') {
    const onAccent = readableOn(sidebarColor ?? '#19A5CA')
    return { label: hexToRgba(onAccent, 0.6), text: onAccent, chipBg: hexToRgba(onAccent, 0.18), chipText: onAccent, bulletColor: hexToRgba(onAccent, 0.5) }
  }
  return { label: '#94A3B8', text: '#334155', chipBg: `${color2}14`, chipText: color2, bulletColor: color2 }
  /* eslint-enable no-restricted-syntax, huisstijl/no-restricted-syntax */
}
