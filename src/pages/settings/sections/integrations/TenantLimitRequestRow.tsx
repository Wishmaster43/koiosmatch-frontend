/**
 * TenantLimitRequestRow — the tenant-facing half of one connector row (LIMITS-BEHEER-1
 * contract §4): the mode text ("bij bereiken: doorgaan/wachtrij/geblokkeerd"), an
 * approval badge when one is active, and a "Verhoging aanvragen" button that POSTs
 * …/request. Renders disabled with an honest notice when `can_request` is false —
 * never a dead click (§3 no fake affordance).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import CalloutBox from '@/components/ui/CalloutBox'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { extractApiError } from '@/lib/extractApiError'
import { postLimitRequest, type LimitRequestStatus, type TenantLimitRow } from './limitsApi'
import { limitModeSentence } from './limitModeLabel'

export default function TenantLimitRequestRow({ row }: { row: TenantLimitRow }) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  // The 202 body carries three distinct outcomes (contract: requested vs
  // already_requested_today vs no_recipient) — never collapse them into one "sent" state.
  const [status, setStatus] = useState<LimitRequestStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => postLimitRequest(row.key),
    onSuccess: (data) => { setError(null); setStatus(data.status) },
    onError: (err) => setError(extractApiError(err, t('limits.save_error'))),
  })

  // A tier-driven row (ai/workflow: settable false, can_request false, no mode) has nothing to
  // say here — render nothing rather than an empty container (the BE serves every field, never omits it).
  if (row.mode_effective == null && !row.approval && !row.can_request && row.settable === false) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {row.mode_effective && <Caption as="div">{limitModeSentence(t, row.mode_effective)}</Caption>}

      {row.approval && (
        <SoftChip color="var(--color-success)" label={t('limits.approval.active', {
          date: row.approval.until ? formatDate(row.approval.until) : '—',
          extra: row.approval.extra_cap != null ? formatNumber(row.approval.extra_cap) : t('limits.no_limit'),
        })} />
      )}

      {!row.can_request ? (
        // settable === false means this connector is tier-driven (contract §2 point 2),
        // never requestable — no button, no notice, ever, not a temporary disabled state.
        row.can_request === false && row.settable !== false && (
          <CalloutBox variant="info">{t('limits.request.disabled_notice')}</CalloutBox>
        )
      ) : status === 'requested' ? (
        <Caption as="div">{t('limits.request.requested')}</Caption>
      ) : status === 'already_requested_today' ? (
        <Caption as="div">{t('limits.request.already_requested_today')}</Caption>
      ) : status === 'no_recipient' ? (
        <Caption as="div">{t('limits.request.no_recipient')}</Caption>
      ) : (
        <Button variant="secondary" size="sm" disabled={isPending} onClick={() => mutate()} style={{ alignSelf: 'flex-start' }}>
          {t('limits.request.button')}
        </Button>
      )}
      {error && <ErrorBanner variant="subtle">{error}</ErrorBanner>}
    </div>
  )
}
