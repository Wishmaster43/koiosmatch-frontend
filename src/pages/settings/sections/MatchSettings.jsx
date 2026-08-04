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
 * Contract types — the match form's "Contractsoort" dropdown (Backend
 * /contract-types). The numberField (7.1, MATCH-CONTRACT-DURATION-1) lets a
 * tenant set each type's default duration in days, feeding the match
 * form's end-date PROPOSAL (useEndDateProposal). Both color and
 * default_duration_days are validated and persisted by
 * ContractTypeController — nothing here is silently dropped.
 *
 * `defaultField` (Danny 24-07 point 4, "voorstel waarde") reuses the exact
 * same is_default singleton toggle as appointment-types/-locations/funnel
 * stages (LOOKUP-DEFAULT-1) — StatusListEditor's DefaultToggle promotes one
 * row and clears the rest; the +Match form preselects whichever type is
 * marked default (useMatchForm), into an empty field only. Contract
 * types were NOT one of the three lookups the backend shipped is_default for
 * yet — honest-gated like numberField above until a BE follow-up adds it.
 */
export function ContractTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('matches.contractTypeTitle')} subtitle={t('matches.contractTypeSubtitle')}
        endpoint="/contract-types" addLabel={t('matches.contractTypeAdd')}
        numberField={{ key: 'default_duration_days', label: t('matches.contractTypeDurationLabel'), default: null }}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}

/**
 * Match stop reasons — the mandatory reason recorded on
 * POST /matches/{id}/terminate (MATCH-TERMINATE-1). Same value/label/color/order
 * shape as MatchStatus (SlugLookupController base) — no extra flags, in-use guarded
 * by match_terminations.stop_reason.
 */
export function MatchStopReasonSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('matches.stopReasonTitle')} subtitle={t('matches.stopReasonSubtitle')}
        endpoint="/match-stop-reasons" addLabel={t('matches.stopReasonAdd')} />
    </div>
  )
}
