import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useConfirm } from '@/hooks/useConfirm'
import { useDateFormat } from '@/lib/datetime'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useProposals } from './useProposals'
import type { Id } from '@/types/common'
import type { ApplicationDetail } from '@/types/application'

interface ProposalsBlockProps {
  application: ApplicationDetail
}

/**
 * ProposalsBlock — the recorded-proposal history on the Sollicitatie tab
 * (PROPOSE-STORE-1). Renders NOTHING while loading, on error, or when there
 * are zero proposals (§3: no empty frame for an optional history block) —
 * only shows once at least one proposal exists.
 *
 * Honest gate: the backend does not return a shareable link yet
 * (PROPOSE-SHARE-URL-1 open), so this block never renders a copy-link/open-
 * link affordance — only the recorded facts (recipient, variant, open state).
 */
export default function ProposalsBlock({ application }: ProposalsBlockProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
  const { proposals, loading, error, revoke, revoking } = useProposals(application.id)
  const { confirm, dialog } = useConfirm()

  if (loading || error || proposals.length === 0) return null

  // Ask for confirmation through the house confirm path before revoking —
  // revoke is destructive (the recipient link, once it exists, stops working).
  const handleRevoke = (proposalId: Id) => {
    confirm(t('propose.revokeConfirm'), () => {
      revoke(proposalId).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
    }, { danger: true, confirmLabel: t('propose.revoke') })
  }

  return (
    <SectionCard title={t('propose.historyTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proposals.map(p => (
          <div key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 160 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.recipient_name || '—'}</div>
              {p.recipient_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.recipient_email}</div>}
            </div>
            <SoftChip label={p.cv_variant === 'full' ? t('propose.variantChipFull') : t('propose.variantChipProposal')} color="var(--color-primary)" />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 90 }}>
              {p.sent_at ? t('propose.sentOn', { date: formatDate(p.sent_at) }) : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', flex: '1 1 160px' }}>
              {p.revoked_at ? (
                <span>{t('propose.revoked', { date: formatDate(p.revoked_at) })}</span>
              ) : p.opened_at ? (
                <span>
                  {t('propose.openedOn', { date: formatDate(p.opened_at) })}
                  {p.open_count > 1 && ` · ${t('propose.openCount', { count: p.open_count })}`}
                </span>
              ) : (
                <span>{t('propose.notOpenedYet')}</span>
              )}
            </div>
            {!p.revoked_at && p.is_valid && (
              <button onClick={() => handleRevoke(p.id)} disabled={revoking} aria-label={t('propose.revoke')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', fontSize: 11,
                  borderRadius: 6, border: '1px solid var(--color-danger)', background: 'none', color: 'var(--color-danger)',
                  cursor: revoking ? 'not-allowed' : 'pointer', opacity: revoking ? 0.6 : 1 }}>
                <X size={11} /> {t('propose.revoke')}
              </button>
            )}
          </div>
        ))}
      </div>
      {dialog}
    </SectionCard>
  )
}
