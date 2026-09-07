/**
 * Career-site settings — its OWN sub-tab under Bedrijf (Danny 23-07,
 * translated: "its own little tab!!" — verbatim: "Eigen tabje!!", moved out
 * of the company-profile form). One live switch: the
 * backend's EnsureCareerSiteActive middleware enforces it on the public site
 * (list/detail/apply/feeds 404 while off), so this is a real control, not a
 * stored preference. Immediate save per toggle (house pattern for single
 * switches). Uses the shared SettingRow + Toggle (Danny 28-07, translated:
 * "must also become a toggle!!" — verbatim: "MOET OOK EEN
 * TOGGLE WORDEN!!") instead of a hand-rolled checkbox, so it matches every
 * other on/off control in Settings; the stored value is still the same boolean.
 * Below it, PublicUrlsCard surfaces this tenant's own public site + job-board
 * feed URLs (the CAREER-1 contract: /site, /vacancies, /sitemap.xml, Indeed +
 * Werkzoeken feeds) so an admin can actually copy them into a job board's feed
 * config instead of hunting through backend docs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { SettingRow, Toggle } from '../components/SettingsKit'
import PublicUrlsCard from './careerSite/PublicUrlsCard'
import { PageTitle, Caption } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

// Career-site on/off toggle plus the public-URLs card (see file docblock above);
// the switch is a real control since the backend middleware enforces it live.
export default function CareerSiteSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  // Booleans round-trip through the settings store as strings — coerce every truthy form.
  const raw = values.career_site_active
  const active = raw === true || raw === 1 || raw === '1' || raw === 'true'

  // Track the URL field's draft and validation state.
  const urlStoredValue = typeof values.career_site_url === 'string' ? values.career_site_url : ''
  const [urlDraft, setUrlDraft] = useState(urlStoredValue)
  const [urlInvalid, setUrlInvalid] = useState(false)

  // Save failure reverts the toggle by refetching the persisted value from the
  // server (the optimistic cache write inside saveSettingsKeys already flipped
  // it) and surfaces an honest error instead of leaving a phantom on/off state.
  const toggle = (checked: boolean) => {
    saveSettingsKeys({ career_site_active: checked }).catch(() => {
      invalidateAllSettingsCache()
      notifyError(t('careerSite.saveError'))
    })
  }

  // Client-side validation: the URL must contain {ref} as a placeholder; on valid
  // commit, save via saveSettingsKeys; backend 422 flows through extractApiError.
  const handleUrlBlur = () => {
    const trimmed = urlDraft.trim()
    const stored = typeof values.career_site_url === 'string' ? values.career_site_url : ''
    // Empty is valid (optional field); otherwise it must contain {ref}.
    if (trimmed === '' || trimmed.includes('{ref}')) {
      setUrlInvalid(false)
      if (trimmed !== stored) {
        saveSettingsKeys({ career_site_url: trimmed }).catch(err => {
          notifyError(extractApiError(err, t('common:actionFailed')))
          // Revert the draft on error.
          setUrlDraft(stored)
        })
      }
    } else {
      setUrlInvalid(true)
    }
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <PageTitle>{t('careerSite.title')}</PageTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>{t('careerSite.subtitle')}</p>

        <SettingRow label={t('careerSite.activeLabel')} description={t('careerSite.hint')}>
          <Toggle checked={active} onChange={toggle} />
        </SettingRow>

        <SettingRow label={t('careerSite.urlLabel')} description={t('careerSite.urlHint')}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input
              type="text"
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder={t('careerSite.urlPlaceholder')}
              style={{
                ...fieldInputStyle,
                width: 280,
                borderColor: urlInvalid ? 'var(--color-danger)' : 'var(--border)',
              }}
            />
            {urlInvalid && <span role="alert"><Caption as="span" style={{ color: 'var(--color-danger-text)' }}>{t('careerSite.urlInvalid')}</Caption></span>}
          </div>
        </SettingRow>
      </div>

      <PublicUrlsCard active={active} />
    </div>
  )
}
