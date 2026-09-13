/**
 * Jargon terms — tenant vocabulary the AI corrects in dictate/improve results
 * (e.g. "bfv" -> "BHV"). Backed by /jargon-terms, same PositionLookup shape as
 * /industries (§ mirror IndustrySettings): no colour, reorderable, no in-use guard.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// Thin StatusListEditor wrapper for the tenant's jargon-correction vocabulary
// (no colour, no active toggle — see the comment below for why).
export default function JargonSettings() {
  const { t } = useTranslation('settings')
  return (
    // Deliberately NO active-flagField (exact /industries mirror): the controller
    // lists active rows only and does not round-trip `active`, so a toggle here
    // silently deactivated terms on every edit-save (Opus round, golf 4).
    <StatusListEditor
      title={t('jargonSettings.title')}
      subtitle={t('jargonSettings.subtitle')}
      endpoint="/jargon-terms"
      addLabel={t('jargonSettings.add')}
      withColor={false}
    />
  )
}
