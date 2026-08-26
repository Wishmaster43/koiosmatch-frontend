/**
 * UserTransferDeleteModal — the hand-off dialog the backend demands before a
 * user who still owns records can be soft-deleted (USER-SOFTDELETE-1).
 *
 * It is opened by `useUserDeletion` from the 422 `{requires_transfer, owned}`
 * body, so it can name exactly HOW MANY records and of WHICH types are at stake
 * (`owned.by_type`, keyed by tenant table name) and let the recruiter pick the
 * colleague who inherits them. Confirming repeats the DELETE with
 * `transfer_to_user_id`. There is no path here that deletes without a successor —
 * that is the whole point: a coupled user is never cut loose from its records.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { userDisplayName } from './userRow'
import type { ManagedUser } from '@/types/api'
import type { OwnedSummary } from './hooks/useUserDeletion'

// `owned.by_type` keys are the backend's tenant TABLE names (measured 09-08 —
// UserOwnershipTransfer::OWNERSHIP_MAP). Each maps to its own ICU-plural label;
// an unmapped table falls back to a generic translated line, never a raw key.
const OWNED_TYPE_KEYS: Record<string, string> = {
  candidates: 'candidates', customers: 'customers', vacancies: 'vacancies',
  matches: 'matches', applications: 'applications', opportunities: 'opportunities',
  appointments: 'appointments', planning_orders: 'planningOrders', pools: 'pools',
  outreach_campaigns: 'outreachCampaigns', tasks: 'tasks', outreach_targets: 'outreachTargets',
}

// The mandatory ownership hand-off dialog before a user can be deleted (see file
// docblock above) — names exactly how many records of which types are at stake
// and requires picking a successor; there is no delete-without-transfer path.
export default function UserTransferDeleteModal({ user, owned, successors, busy, onConfirm, onClose }: {
  user: ManagedUser
  owned: OwnedSummary
  // Colleagues that may inherit the records (already excludes the user itself).
  successors: ManagedUser[]
  busy: boolean
  onConfirm: (successorId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('users')
  const [successorId, setSuccessorId] = useState<string | null>(null)
  const successorLabelId = useId()

  // Only the non-zero types come back from the server, so this list is already
  // the exact "what must move" set — rendered as translated, pluralised lines.
  const ownedRows = Object.entries(owned.by_type ?? {})
  const label = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5 } as const

  return (
    <FloatingPanel open onClose={onClose} title={t('delete.title')} ariaLabel={t('delete.title')}
      persistKey="user-transfer-delete" width={440} bodyStyle={{ padding: '20px 24px 24px' }}>

      {/* Why this dialog exists: the account still carries live ownership. */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                    background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-warning) 33%, transparent)' }}>
        <AlertTriangle size={15} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
          {t('delete.explain', { name: userDisplayName(user), count: owned.total })}
        </p>
      </div>

      {/* Exactly what is at stake, per object type (from the server's by_type). */}
      <div style={{ marginBottom: 16 }}>
        <span style={label}>{t('delete.ownedTitle')}</span>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none' }}>
          {ownedRows.map(([type, count]) => (
            <li key={type} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 99,
                                     color: 'var(--text)', background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
              {OWNED_TYPE_KEYS[type]
                ? t(`delete.types.${OWNED_TYPE_KEYS[type]}`, { count })
                : t('delete.types.other', { type, count })}
            </li>
          ))}
        </ul>
      </div>

      {/* Successor — the house searchable picker, never a native select. The
          picker's trigger is a <button>, which `htmlFor` cannot label, so the
          visible label is wired through aria-labelledby (§6, mirrors NewUserModal). */}
      <div style={{ marginBottom: 20 }}>
        <span id={successorLabelId} style={label}>{t('delete.successor')}</span>
        <CreatableSelect aria-labelledby={successorLabelId} value={successorId} onChange={setSuccessorId}
          allowCreate={false} placeholder={t('delete.successorPlaceholder')} style={fieldInputStyle}
          options={successors.map(u => ({ value: String(u.id), label: userDisplayName(u) }))} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('delete.successorHint')}</p>
      </div>

      {/* Actions — confirming is the ONLY delete path from here, and it always
          carries a successor, so ownership can never be dropped. */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>
          {t('common:cancel')}
        </Button>
        <Button variant="danger" disabled={busy || !successorId} onClick={() => successorId && onConfirm(successorId)}>
          {busy && <Spinner size={13} />}
          {t('delete.confirm')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
