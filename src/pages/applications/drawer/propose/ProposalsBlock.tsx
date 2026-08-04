import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useConfirm } from '@/hooks/useConfirm'
import { useDateFormat } from '@/lib/datetime'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useProposals } from './useProposals'
import type { Id } from '@/types/common'
import type { ApplicationDetail } from '@/types/application'

interface ProposalsBlockProps {
  application: ApplicationDetail
}

// Shared button styling for the two link actions — same footprint as the
// existing revoke button, just tinted with the primary token instead of danger.
// BUTTON-SOFT-TINT-1 (Danny 05-08): was a white/transparent outline — now the
// house soft-tint recipe (§4, mirrors DrawerAddButton/QuickViewToggle).
const linkButtonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  height: 26, minWidth: 26, padding: '0 8px', fontSize: 11, borderRadius: 6,
  border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)',
  cursor: 'pointer', textDecoration: 'none',
}

/**
 * ProposalsBlock — the recorded-proposal history on the Sollicitatie tab
 * (PROPOSE-STORE-1). Renders NOTHING while loading, on error, or when there
 * are zero proposals (§3: no empty frame for an optional history block) —
 * only shows once at least one proposal exists.
 *
 * PROPOSE-SHARE-URL-1 shipped on the backend: a sent, non-revoked proposal now
 * carries a real recipient-facing `share_url` (+ `share_expires_at`) — the API
 * only attaches these for a viewer who may write, and nulls both once revoked
 * (ApplicationProposalController::withShareLink / ProposalLink::shareFor). This
 * block renders a copy-link and an open-in-new-tab action for that link, and
 * shows the genuine opened/not-opened state now that a customer can actually
 * open the proposal. A revoked proposal never offers the link — guarded the
 * same way the revoke button already is (`!p.revoked_at`), never by only
 * trusting the field to be absent. The raw link is never logged, never put
 * into an analytics payload, and never rendered anywhere outside this block.
 */
export default function ProposalsBlock({ application }: ProposalsBlockProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
  const { proposals, loading, error, revoke, revoking } = useProposals(application.id)
  const { confirm, dialog } = useConfirm()

  // Per-row "copied" feedback — a short-lived id, cleared on unmount or replaced.
  const [copiedId, setCopiedId] = useState<Id | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }, [])

  if (loading || error || proposals.length === 0) return null

  // Ask for confirmation through the house confirm path before revoking —
  // revoke is destructive (the recipient link, once it exists, stops working).
  const handleRevoke = (proposalId: Id) => {
    confirm(t('propose.revokeConfirm'), () => {
      revoke(proposalId).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
    }, { danger: true, confirmLabel: t('propose.revoke') })
  }

  // Copy the share link to the clipboard only — the toast and the icon-flip
  // feedback are static, never carry the URL itself (no leak into the log/toast).
  const handleCopyLink = async (proposalId: Id, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(proposalId)
      notifySuccess(t('propose.linkCopied'))
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
    } catch {
      notifyError(t('common:actionFailed'))
    }
  }

  return (
    <SectionCard title={t('propose.historyTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proposals.map(p => {
          // The link actions only ever render for a still-live proposal — the
          // same guard the revoke button uses below, never just "share_url
          // happens to be truthy" (defense in depth against a stale/backfilled row).
          const canShare = !p.revoked_at && p.is_valid && Boolean(p.share_url)
          return (
            <div key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 auto', minWidth: 160 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.recipient_name || '—'}</div>
                {p.recipient_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.recipient_email}</div>}
              </div>
              <SoftChip label={p.cv_variant === 'full' ? t('propose.variantChipFull') : t('propose.variantChipProposal')} color="var(--color-primary)" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 90 }}>
                {p.sent_at ? t('propose.sentOn', { date: formatDate(p.sent_at) }) : '—'}
              </div>
              {/* Open-state line: revoked > opened (+ count) > not opened yet — one of
                  the three always renders now that opened_at reflects a real customer
                  visit (PROPOSE-SHARE-URL-1), regardless of whether THIS viewer holds
                  the link (opened_at/open_count are not permission-gated on the API). */}
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
              {canShare && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={() => handleCopyLink(p.id, p.share_url as string)}
                    aria-label={t('propose.copyLink')} title={t('propose.copyLink')} style={linkButtonStyle}>
                    {copiedId === p.id ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                  <a href={p.share_url as string} target="_blank" rel="noopener noreferrer"
                    aria-label={t('propose.openLink')} title={t('propose.openLink')} style={linkButtonStyle}>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {/* BUTTON-SOFT-TINT-1 (Danny 05-08): was a white/transparent outline
                  button — now the house soft-tint recipe (§4). */}
              {!p.revoked_at && p.is_valid && (
                <button onClick={() => handleRevoke(p.id)} disabled={revoking} aria-label={t('propose.revoke')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', fontSize: 11,
                    borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                    background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)',
                    cursor: revoking ? 'not-allowed' : 'pointer', opacity: revoking ? 0.6 : 1 }}>
                  <X size={11} /> {t('propose.revoke')}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {dialog}
    </SectionCard>
  )
}
