import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { SettingRow, Toggle } from '../components/SettingsKit'

/**
 * Career-site settings — its OWN sub-tab under Bedrijf (Danny 23-07: "Eigen
 * tabje!!", moved out of the company-profile form). One live switch: the
 * backend's EnsureCareerSiteActive middleware enforces it on the public site
 * (list/detail/apply 404 while off), so this is a real control, not a stored
 * preference. Immediate save per toggle (house pattern for single switches).
 * Uses the shared SettingRow + Toggle (Danny 28-07: "MOET OOK EEN TOGGLE
 * WORDEN!!") instead of a hand-rolled checkbox, so it matches every other
 * on/off control in Settings; the stored value is still the same boolean.
 */
export default function CareerSiteSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  // Booleans round-trip through the settings store as strings — coerce every truthy form.
  const active = [true, 1, '1', 'true'].includes(values.career_site_active)

  const toggle = (checked) => { saveSettingsKeys({ career_site_active: checked }).catch(() => {}) }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('careerSite.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>{t('careerSite.subtitle')}</p>

      <SettingRow label={t('careerSite.activeLabel')} description={t('careerSite.hint')}>
        <Toggle checked={active} onChange={toggle} />
      </SettingRow>
    </div>
  )
}
