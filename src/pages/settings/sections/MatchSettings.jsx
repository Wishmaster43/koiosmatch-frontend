import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Match lookups — tenant-managed lists behind the Matches feature. Reuse the shared
 * StatusListEditor (name + colour + reorder + 409 in-use), so nothing is hardcoded.
 */

/** Match statuses — the match lifecycle values. Backend /match-statuses (R-1). */
export function MatchStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      {/* allowAdd off until R-1b: a brand-new status isn't write-usable yet (BE side-effects key on
          the seeded slugs) — the personalisation layer (relabel/colour/reorder) is fully supported. */}
      <StatusListEditor compact withColor allowAdd={false} title={t('matches.statusTitle')} subtitle={t('matches.statusSubtitle')}
        endpoint="/match-statuses" addLabel={t('matches.statusAdd')} />
    </div>
  )
}
