/**
 * CaoSettings — the CAO (collective labour agreement) lookup finally gets its
 * Settings home (Danny 24-07: "ik zie geen CAO's bij instellingen" — "I don't
 * see any CAOs in Settings" — the /cao endpoint had full CRUD +
 * reorder + in-use 409 (via matches.cao) but no screen, same gap class as
 * provinces). Name-only list; drives the customer price agreements and the
 * + Match popup's CAO picker.
 *
 * withValueSlug (LOOKUP-GAP-1(d) verification 08-08): CaoController extends
 * SlugLookupController, whose store() validates `value` as REQUIRED — without
 * this opt-in StatusListEditor only ever sent name/label and "+ CLA toevoegen"
 * would 422 on every tenant (same bug class already fixed for
 * CustomerPhasesSettings/OpportunityLookupsSettings — see StatusListEditor.jsx).
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

export default function CaoSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor
        title={t('caoSettings.title')}
        subtitle={t('caoSettings.subtitle')}
        endpoint="/cao"
        addLabel={t('caoSettings.add')}
        withColor
        withValueSlug
      />
    </div>
  )
}
