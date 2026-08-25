// LanguageSettings — the two Languages sub-tabs: the language list itself and
// its proficiency levels, each a tenant-maintainable lookup via StatusListEditor.
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Languages — the language list, its own sub-tab. Feeds the candidate Languages section. */
export function LanguageListSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor={false}
        title={t('languageSettings.languagesTitle')} subtitle={t('languageSettings.languagesSubtitle')}
        endpoint="/languages" addLabel={t('languageSettings.addLanguage')} />
    </div>
  )
}

/** Levels — the proficiency levels (spoken/written), its own sub-tab. */
export function LanguageLevelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor={false}
        title={t('languageSettings.levelsTitle')} subtitle={t('languageSettings.levelsSubtitle')}
        endpoint="/language-levels" addLabel={t('languageSettings.addLevel')} />
    </div>
  )
}
