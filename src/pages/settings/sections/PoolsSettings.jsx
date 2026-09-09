import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/** Talent pools — name + colour CRUD (and drag-reorder), like the other lookups.
 * Backed by /pools; the same colour drives the chips in the candidate list/drawer. */
export default function PoolsSettings() {
  const { t } = useTranslation('settings')
  // SMZ-06: no `context` picker here — GET /pools (no query params, exactly what
  // StatusListEditor sends) defaults to context=recruitment, so a pool created
  // here as "planning" would never be readable/editable/deletable again from
  // this screen. Offering the vocabulary back would be a dead affordance; a
  // planning-context picker returns once a planning surface can read it.
  return (
    // withIcon (batch 12, P22-30): icon picker in the row next to the colour swatch.
    <StatusListEditor
      title={t('poolsSettings.title')}
      subtitle={t('poolsSettings.subtitle')}
      endpoint="/pools"
      addLabel={t('poolsSettings.add')}
      withColor
      withIcon
    />
  )
}
