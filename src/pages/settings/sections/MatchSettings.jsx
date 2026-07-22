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
      {/* R-1b live: tenant-added statuses are write-usable; the is_closed FLAG (never the
          slug) drives behaviour — a closed status ends the match (ended_at + open count). */}
      <StatusListEditor compact withColor title={t('matches.statusTitle')} subtitle={t('matches.statusSubtitle')}
        endpoint="/match-statuses" addLabel={t('matches.statusAdd')}
        flagField={{ key: 'is_closed', label: t('matches.flagClosed'), description: t('matches.flagClosedDesc') }} />
    </div>
  )
}

/**
 * Contract types — the placement form's "Contractsoort" dropdown (Backend
 * /contract-types). The numberField (7.1, MATCH-CONTRACT-DURATION-1) lets a
 * tenant set each type's default duration in days, feeding the placement
 * form's end-date PROPOSAL (useEndDateProposal). Honest-gate: the backend
 * doesn't persist this column yet, so saved values are silently dropped until
 * it ships — same gate the field's own hook already documents.
 */
export function ContractTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('matches.contractTypeTitle')} subtitle={t('matches.contractTypeSubtitle')}
        endpoint="/contract-types" addLabel={t('matches.contractTypeAdd')}
        numberField={{ key: 'default_duration_days', label: t('matches.contractTypeDurationLabel'), default: null }} />
    </div>
  )
}
