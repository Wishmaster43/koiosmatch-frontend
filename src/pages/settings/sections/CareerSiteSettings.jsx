import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'

/**
 * Career-site settings — its OWN sub-tab under Bedrijf (Danny 23-07: "Eigen
 * tabje!!", moved out of the company-profile form). One live switch: the
 * backend's EnsureCareerSiteActive middleware enforces it on the public site
 * (list/detail/apply 404 while off), so this is a real control, not a stored
 * preference. Immediate save per toggle (house pattern for single switches).
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={active} onChange={e => toggle(e.target.checked)}
          style={{ accentColor: 'var(--color-primary)' }} />
        {active ? t('careerSite.on') : t('careerSite.off')}
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{t('careerSite.hint')}</p>
    </div>
  )
}
