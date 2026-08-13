/**
 * SettingsChangelogButton — THE one shared changelog affordance for the settings
 * scaffold (CHANGELOG-OVERAL-1, item 3): rendered once in SettingsPage's content
 * header so every settings screen carries it, never hand-rolled per section. Wraps
 * the shared ChangelogPopover + EntityChangelog, filtered to `subject_type=Setting`
 * — "who changed which tenant setting, when".
 */
import { useTranslation } from 'react-i18next'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import EntityChangelog from '@/components/drawer/EntityChangelog'

export default function SettingsChangelogButton() {
  const { t } = useTranslation('settings')
  return (
    <ChangelogPopover label={t('audit.title')}>
      {/* log_name, not subject_type: settings audit manually without performedOn,
          so their subject_type is NULL (verified 14-08) — the type filter finds nothing. */}
      <EntityChangelog logName="settings" />
    </ChangelogPopover>
  )
}
