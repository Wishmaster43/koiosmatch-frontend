/**
 * RadiusControlRow — the ONE radius row (label + house Slider + exact-km input),
 * lifted out of RadiusMapPanel after the 22-08 eindcontrole found GeoSearchShell
 * carrying a verbatim copy (§11: a shared helper lands WITH adoption on the
 * copy sites). Both consumers keep their own count-line and layout around it;
 * this row owns the slider domain and the clamp rules.
 */
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import Slider from '@/components/ui/Slider'

// Slider domain: 5km floor (a 0-radius circle is meaningless), 150 ceiling on
// the slider (the exact input allows up to 300), 5km steps.
export const RADIUS_SLIDER_MIN = 5
export const RADIUS_SLIDER_MAX = 150
export const RADIUS_SLIDER_STEP = 5

// The shared radius row (label + slider + exact-km input); owns the slider
// domain and clamps a dragged/typed value back onto the 5km floor.
export default function RadiusControlRow({ value, onChange, children }: {
  value: number
  onChange: (km: number) => void
  // Optional trailing affordance inside the row (RadiusMapPanel's clear-pill).
  children?: ReactNode
}) {
  const { t } = useTranslation('common')
  // Clamp back onto the 5km floor; the number input enforces its own >=1 guard.
  const handleSliderChange = (v: number) => onChange(Math.max(RADIUS_SLIDER_MIN, v))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{t('map.radius')}</span>
      <div style={{ width: 110, flexShrink: 0 }}>
        <Slider value={value > 0 ? value : 30} max={RADIUS_SLIDER_MAX} step={RADIUS_SLIDER_STEP}
          onChange={handleSliderChange} ariaLabel={t('map.radius')} />
      </div>
      <input type="number" min={1} max={300} value={value > 0 ? value : ''} placeholder="—" aria-label={t('map.radius')}
        onChange={e => { const v = Number(e.target.value); if (v >= 1) onChange(v) }}
        style={{ width: 56, padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
                 background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none' }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
      {children}
    </div>
  )
}
