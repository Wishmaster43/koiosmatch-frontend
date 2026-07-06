/**
 * ClearFiltersButton — one shared "wis alle filters" affordance for every list page.
 * Renders ONLY while something filters the view (search, donut/KPI picks, attention,
 * archived, …): page memory keeps filters alive across navigation (2026-07-06), so
 * without this a returning user could face an invisibly narrowed list (Danny's
 * "filters worden niet toegepast"-verwarring). One click = back to the default view.
 * It also reports its active state to RightPanelContext, so the topbar filter icon
 * shows a dot while the page is filtered (Danny 2026-07-06) — no per-page wiring.
 */
import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterX } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'

export default function ClearFiltersButton({ active, onClear }: { active: boolean; onClear: () => void }) {
  const { t } = useTranslation('common')
  const { reportPageFilter } = useRightPanel()
  const id = useId()

  // Feed the topbar filter-icon indicator; clear on unmount so it never sticks.
  useEffect(() => {
    reportPageFilter(id, active)
    return () => reportPageFilter(id, false)
  }, [id, active, reportPageFilter])

  if (!active) return null
  return (
    <button onClick={onClear} title={t('clearFilters')} aria-label={t('clearFilters')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 11, fontWeight: 600,
        borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--color-warning)',
        background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
      <FilterX size={12} /> {t('clearFilters')}
    </button>
  )
}
