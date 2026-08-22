/**
 * ApplicationRequiredFieldsSettings — Settings → Sollicitaties → Verplichte velden
 * (APP-REQUIRED-FE-1, Danny: "hoe zorg ik dat BRON bij nieuwe sollicitatie
 * verplicht is? moet bij instellingen komen").
 *
 * The application has no phase axis of its own here (the funnel stage is a
 * per-application picker, not a settings-facing axis) — this mirrors the
 * customer sub-entities' FLAT shape (`FlatRequiredFieldsToggleList`, already built
 * for Locatie/Afdeling/Contactpersoon) rather than the candidate/customer phase
 * matrix: one toggle per field, saved whole to the flat `application_required_fields`
 * array `FlatRequiredFieldsGuard('application')` reads on `ApplicationController::store`.
 *
 * No seeded default: an absent setting means nothing extra is required — the same
 * "everything off is the honest state" rule as every other required-fields screen.
 */
import { useTranslation } from 'react-i18next'
import FlatRequiredFieldsToggleList from './customers/FlatRequiredFieldsToggleList'
import { APPLICATION_FIELDS } from './applications/requiredFieldsCatalog'

const KEY = 'application_required_fields'

export default function ApplicationRequiredFieldsSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 760 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        {t('applicationRequiredFields.title')}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        {t('applicationRequiredFields.subtitle')}
      </p>
      <FlatRequiredFieldsToggleList settingKey={KEY} fields={APPLICATION_FIELDS} hintKey="applicationRequiredFields.hint" />
    </div>
  )
}
