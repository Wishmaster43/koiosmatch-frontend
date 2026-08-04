import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * NationalitiesSettings — the candidate nationality lookup (LOOKUP-GAP-1, backend
 * NationalityController extends SimpleLookupController: plain name+colour CRUD, no
 * sort_order/reorder route, delete guarded 409 by candidates.nationality). Consumed
 * by useNationalities → ProfilePersonalTab. Thin wrapper mirrors RejectionSettings —
 * the same SimpleLookupController shape (no reorder endpoint on the backend).
 */
export default function NationalitiesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off: SimpleLookupController family has no /reorder route (audit 04-08).
          withColor off: a colour on a nationality carries no meaning (§4 — "alles 1 kleur?",
          Danny 05-08); the real adornment is a country FLAG, which needs a backend
          country_code column first (NATION-FLAG-1) — flag render lands with that ticket. */}
      <StatusListEditor reorderable={false} withColor={false} title={t('nationalities.title')} subtitle={t('nationalities.subtitle')}
        endpoint="/nationalities" addLabel={t('nationalities.add')} />
    </div>
  )
}
