/**
 * Career-site settings — its OWN sub-tab under Bedrijf (Danny 23-07: "Eigen
 * tabje!!", moved out of the company-profile form). One live switch: the
 * backend's EnsureCareerSiteActive middleware enforces it on the public site
 * (list/detail/apply/feeds 404 while off), so this is a real control, not a
 * stored preference. Immediate save per toggle (house pattern for single
 * switches). Uses the shared SettingRow + Toggle (Danny 28-07: "MOET OOK EEN
 * TOGGLE WORDEN!!") instead of a hand-rolled checkbox, so it matches every
 * other on/off control in Settings; the stored value is still the same boolean.
 * Below it, PublicUrlsCard surfaces this tenant's own public site + job-board
 * feed URLs (the CAREER-1 contract: /site, /vacancies, /sitemap.xml, Indeed +
 * Werkzoeken feeds) so an admin can actually copy them into a job board's feed
 * config instead of hunting through backend docs.
 */
import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { SettingRow, Toggle } from '../components/SettingsKit'
import PublicUrlsCard from './careerSite/PublicUrlsCard'

export default function CareerSiteSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  // Booleans round-trip through the settings store as strings — coerce every truthy form.
  const raw = values.career_site_active
  const active = raw === true || raw === 1 || raw === '1' || raw === 'true'

  const toggle = (checked: boolean) => { saveSettingsKeys({ career_site_active: checked }).catch(() => {}) }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('careerSite.title')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>{t('careerSite.subtitle')}</p>

        <SettingRow label={t('careerSite.activeLabel')} description={t('careerSite.hint')}>
          <Toggle checked={active} onChange={toggle} />
        </SettingRow>
      </div>

      <PublicUrlsCard active={active} />
    </div>
  )
}
