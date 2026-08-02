/**
 * ImportOrderBanner — the "do this in order" explainer (customers → locations →
 * departments → contacts) for the four SEPARATE files. A location/department/contact
 * links to its parent BY NAME (klant_naam/locatie_naam/afdeling_naam), so importing
 * out of order produces nothing but "not found" errors — this banner stays visible on
 * every step, not just the first, so the reminder survives a scroll or a step change.
 *
 * It never renders for the combined whole-customer file (WholeTreeBanner does), and
 * it now names that alternative instead of leaving a user to discover it: these four
 * are the right tool for EXTENDING a customer that already exists, the combined file
 * for creating a new one in one go — never both for the same data.
 */
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

// Fixed order, independent of the API response — the DEPENDENCY order between these
// four entities is a business rule, not something the backend's list order implies.
const ORDER: readonly string[] = ['customers', 'locations', 'departments', 'contacts']

interface ImportOrderBannerProps {
  entity: string
  /** The combined whole-customer template, when the backend offers one; null hides the switch. */
  wholeTreeEntity: string | null
  onSelectEntity: (entity: string) => void
}

export default function ImportOrderBanner({ entity, wholeTreeEntity, onSelectEntity }: ImportOrderBannerProps) {
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

      {/* The one-file alternative, offered rather than hidden — a user creating a
          brand-new customer should not have to run these four in sequence. */}
      {wholeTreeEntity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('import.order.treeAlternative')}</span>
          <button type="button" onClick={() => onSelectEntity(wholeTreeEntity)}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none',
                     border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {t('import.order.switchToTree')}
          </button>
        </div>
      )}
    </div>
  )
}
