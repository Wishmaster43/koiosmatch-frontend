/**
 * ImportOrderBanner — the "do this in order" explainer (customers → locations →
 * departments → contacts). A location/department/contact links to its parent BY
 * NAME (klant_naam/locatie_naam/afdeling_naam), so importing out of order produces
 * nothing but "not found" errors — this banner stays visible on every step, not
 * just the first, so the reminder survives a scroll or a step change.
 */
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

// Fixed order, independent of the API response — the DEPENDENCY order between these
// four entities is a business rule, not something the backend's list order implies.
const ORDER: readonly string[] = ['customers', 'locations', 'departments', 'contacts']

interface ImportOrderBannerProps {
  entity: string
}

export default function ImportOrderBanner({ entity }: ImportOrderBannerProps) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ padding: '10px 14px',
      background: 'color-mix(in srgb, var(--color-info) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-info) 25%, transparent)',
      borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('import.order.title')}:</span>
        {ORDER.map((id, index) => (
          <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: id === entity ? 700 : 400, color: id === entity ? 'var(--color-primary)' : 'var(--text-muted)' }}>
              {t(`import.entities.${id}.label`, { defaultValue: id })}
            </span>
            {index < ORDER.length - 1 && <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
          </span>
        ))}
      </div>
      {/* Per-entity hint (which link columns it needs); falls back to the generic
          hint for any future entity the backend adds that isn't in ORDER above. */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
        {t(`import.order.${entity}Hint`, { defaultValue: t('import.order.hint') })}
      </div>
    </div>
  )
}
