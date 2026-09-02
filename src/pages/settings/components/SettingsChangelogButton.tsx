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

// The one shared changelog affordance for settings screens; see the module doc comment above for why it lives here, not per-section.
export default function SettingsChangelogButton() {
  const { t } = useTranslation('settings')
  return (
    <ChangelogPopover label={t('audit.title')}>
      {/* log_name 'settings' is the ONE source since SETTINGS-AUDIT-1 (K-251, 02-09):
          every Setting write is audited on the model (subject_type=Setting, secrets
          masked); the old manual bulk entries are gone, so nothing else carries it. */}
      <EntityChangelog logName="settings" />
    </ChangelogPopover>
  )
}
