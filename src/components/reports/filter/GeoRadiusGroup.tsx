/**
 * GeoRadiusGroup — the "straal" filter block: postcode/place + km → the host
 * geocodes (PDOK) and applies the server-side lat/lng/radius filter. Dumb UI:
 * local input state only; `applied` / `hint` / handlers come from the host page.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, X } from 'lucide-react'
import type { ReportFilterGroup } from '@/types/reports'
import Button from '@/components/ui/Button'

const inputStyle = {
  padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const,
}

// Dumb radius-filter block (see the module doc above): local draft input only, the applied filter's own state/handlers come from the host page.
export default function GeoRadiusGroup({ group }: { group: ReportFilterGroup }) {
  const { t } = useTranslation('common')
  const [q,  setQ]  = useState('')
  const [km, setKm] = useState(group.km ?? 30)

  // Applied state: one removable line instead of the inputs.
  if (group.applied) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6,
                    background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
        <MapPin size={12} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-primary-text)', fontWeight: 500,
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.applied.label}
        </span>
        {/* Dense applied-filter row: the 11px clear glyph keeps its flush footprint
            (Button's 28px square would inflate the row — mirrors the search-box
            clear-icon precedent). Block form: the style attr spans the tag. */}
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
        <button onClick={() => group.onClear?.()} aria-label={t('filters.clear')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary-text)', padding: 0, display: 'flex' }}>
          <X size={11} />
        </button>
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
      </div>
    )
  }

  const apply = () => { if (q.trim()) group.onApply?.(q.trim(), km) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply() }}
        placeholder={t('filters.geoPlaceholder')} aria-label={t('filters.geoPlaceholder')}
        style={{ width: '100%', ...inputStyle }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input value={km} onChange={e => setKm(Number(e.target.value) || 0)} type="number" min={1} max={300}
          aria-label={t('filters.radius')} style={{ width: 64, ...inputStyle }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
        {/* House Button (r4 follow-up): the enabled state hand-painted the raw
            accent — an accent ACTION reads the trio via Button; disabled is
            Button's own grey recipe. */}
        <Button variant="primary" size="sm" onClick={apply} disabled={!q.trim()}
          style={{ marginLeft: 'auto' }}>
          {t('filters.apply')}
        </Button>
      </div>
      {group.hint && <div style={{ fontSize: 11, color: 'var(--color-warning-text)' }}>{group.hint}</div>}
    </div>
  )
}
