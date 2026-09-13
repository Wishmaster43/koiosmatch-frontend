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
          nationality does — derived from the row's `country_code`; a row without a code
          simply shows no flag. LOOKUP-CODES-1 (BE f7b6d529) also serves icon+color on
          /languages, so — mirroring NationalitiesSettings — withIcon/withColor turn on:
          the flag stays the ONE adornment on rows that carry a country_code
          (rowPrefix suppresses the value mark, LOOKUP-ONE-ELEMENT-1), the icon-in-colour
          mark is what a flagless row shows. */}
      <StatusListEditor compact withColor withIcon
        title={t('languageSettings.languagesTitle')} subtitle={t('languageSettings.languagesSubtitle')}
        endpoint="/languages" addLabel={t('languageSettings.addLanguage')}
        rowPrefix={(item) => {
          // country_code rides the lookup item's index signature (not a fixed StatusListItem field).
          const countryCode = item.country_code as string | undefined
          return countryCode ? (
            <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{getFlagEmoji(countryCode)}</span>
          ) : null
        }} />
    </div>
  )
}

/** Levels — the proficiency levels (spoken/written), its own sub-tab.
 * No withIcon/withColor: language_levels has neither column yet on the backend
 * (LOOKUP-ICONS-FE-2 round-4 hash, ±19:30 13-09) — revisit once that lands. */
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
