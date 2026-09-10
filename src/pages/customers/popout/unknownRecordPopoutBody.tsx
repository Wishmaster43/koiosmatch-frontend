/**
 * unknownRecordPopoutBody — an element BUILDER (called, never rendered as a
 * tag; camelCase like appointmentsTabGate) for the honest "unknown record" state for a
 * malformed/legacy composite popout id (§3 — never a silent wrong fetch),
 * byte-identical between CustomerContactTextPopout and
 * CustomerDepartmentTextPopout (DRY round 11, CUSTTABS2).
 */
import type { TFunction } from 'i18next'
import SharedTextPopoutBody from './SharedTextPopoutBody'

// Renders the shared error shell for a popout id that failed to parse; onRetry re-runs the caller's own load.
export function unknownRecordPopoutBody(t: TFunction, onRetry: () => void) {
  return (
    <SharedTextPopoutBody
      loading={false} error onRetry={onRetry}
      loadingLabel="" errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name="" subtitle="" text="" dirty={false} onChange={() => {}} onSave={async () => false}
    />
  )
}
