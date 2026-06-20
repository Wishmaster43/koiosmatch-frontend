import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Talen — two configurable lists: the language list and the proficiency levels.
 * Feed the dropdowns in the candidate Talen-sectie (useLanguageLookups). */
export default function LanguageSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <StatusListEditor compact withColor={false}
        title={t('languageSettings.languagesTitle')} subtitle={t('languageSettings.languagesSubtitle')}
        endpoint="/languages" addLabel={t('languageSettings.addLanguage')} />
      <StatusListEditor compact withColor={false}
        title={t('languageSettings.levelsTitle')} subtitle={t('languageSettings.levelsSubtitle')}
        endpoint="/language-levels" addLabel={t('languageSettings.addLevel')} />
    </div>
  )
}
