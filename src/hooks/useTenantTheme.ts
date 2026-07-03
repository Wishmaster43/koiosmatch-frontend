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

export function useTenantTheme(tenant?: { primary_color?: string | null } | null): void {
  const settings = useAllSettings()
  // The Branding form saves settings.brand_color; some tenant payloads carry primary_color.
  // These two halves never met before (form saved one key, the applier read the other) —
  // read both, the tenant-facing Branding setting wins.
  const brand = (settings?.brand_color as string | undefined) ?? tenant?.primary_color

  useEffect(() => {
    const root = document.documentElement
    if (isHexColor(brand)) {
      root.style.setProperty('--color-primary', brand)
      root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${brand} 70%, white)`)
      root.style.setProperty('--color-primary-bg', `color-mix(in srgb, ${brand} 12%, transparent)`)
    } else {
      // No (valid) tenant brand → fall back to the index.css defaults.
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-light')
      root.style.removeProperty('--color-primary-bg')
    }
    // Reset on unmount (e.g. logout unmounts the layout) so the next tenant starts clean.
    return () => {
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-light')
      root.style.removeProperty('--color-primary-bg')
    }
  }, [brand])
}
