// LanguageSettings — the two Languages sub-tabs: the language list itself and
// its proficiency levels, each a tenant-maintainable lookup via StatusListEditor.
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { getFlagEmoji } from '@/lib/countries'

/** Languages — the language list, its own sub-tab. Feeds the candidate Languages section. */
export function LanguageListSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* Danny 09-09 ("geen vlag lekker consistent"): a language row wears its flag the way a
          nationality does — derived from the row's `country_code` (CMBE icon round 2 adds the
          column and seeds it); a row without a code simply shows no flag. */}
      <StatusListEditor compact withColor={false}
        title={t('languageSettings.languagesTitle')} subtitle={t('languageSettings.languagesSubtitle')}
        endpoint="/languages" addLabel={t('languageSettings.addLanguage')}
        rowPrefix={(item) => item.country_code ? (
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{getFlagEmoji(item.country_code)}</span>
        ) : null} />
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
