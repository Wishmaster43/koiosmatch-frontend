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
      {/* reorderable off: SimpleLookupController family has no /reorder route (audit 04-08) */}
      <StatusListEditor reorderable={false} title={t('nationalities.title')} subtitle={t('nationalities.subtitle')}
        endpoint="/nationalities" addLabel={t('nationalities.add')} withColor />
    </div>
  )
}
