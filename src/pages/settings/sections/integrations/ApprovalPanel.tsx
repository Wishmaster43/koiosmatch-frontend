/**
 * ApprovalPanel — the super-admin "Toestemming geven" form on one tenant connector
 * row (LIMITS-BEHEER-1 contract §3 POST/DELETE approvals): until date, extra cap,
 * surcharge (euros, stored in cents) and a note; an active approval renders as a
 * badge with a Revoke button gated behind the shared ConfirmDialog (§3 destructive
 * actions are never a bare click).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import NumberInput from '@/components/ui/NumberInput'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import SoftChip from '@/components/ui/SoftChip'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { GroupLabel, Caption, captionStyle } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { extractApiError } from '@/lib/extractApiError'
import { postApproval, deleteApproval, type LimitApproval } from './limitsApi'

interface Props {
  tenantId: string
  connector: string
  approval: LimitApproval | null
  // Contract §3: wa_web/anthropic/whatsapp/opencage connectors 422 `limits.not_tenant_scoped` on
  // POST/DELETE approvals — render the existing approval as read-only there, no grant/revoke.
  readOnly?: boolean
}

// Grant/revoke form for one tenant connector's approval, plus the active-approval badge.
export default function ApprovalPanel({ tenantId, connector, approval, readOnly }: Props) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const { formatNumber, formatCurrency } = useNumberFormat()
  const queryClient = useQueryClient()
  const [until, setUntil] = useState('')
  const [extraCap, setExtraCap] = useState<number | null>(null)
  const [surchargeEuros, setSurchargeEuros] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-tenant-limits', tenantId] })

  // Grant: cents are derived from the euro input at the boundary (§4 GETALLEN-1 — the API stays raw).
  const grant = useMutation({
    mutationFn: () => postApproval(tenantId, connector, {
      until: until || null,
      extra_cap: extraCap,
      surcharge_cents: surchargeEuros == null ? null : Math.round(surchargeEuros * 100),
      note: note || null,
    }),
    onSuccess: () => { setError(null); setUntil(''); setExtraCap(null); setSurchargeEuros(null); setNote(''); invalidate() },
    onError: (err) => setError(extractApiError(err, t('limits.approval.error'))),
  })

  const revoke = useMutation({
    mutationFn: () => deleteApproval(tenantId, connector, approval!.id),
    onSuccess: () => { setError(null); setConfirmRevoke(false); invalidate() },
    onError: (err) => { setConfirmRevoke(false); setError(extractApiError(err, t('limits.approval.error'))) },
  })

  if (approval) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SoftChip color="var(--color-success)" label={t('limits.approval.active', {
          date: approval.until ? formatDate(approval.until) : '—',
          extra: approval.extra_cap != null ? formatNumber(approval.extra_cap) : t('limits.no_limit'),
        })} />
        {approval.approved_by_name && <Caption>{t('limits.approval.approved_by', { name: approval.approved_by_name })}</Caption>}
        {approval.surcharge_cents != null && <Caption>{t('limits.approval.surcharge_line', { amount: formatCurrency(approval.surcharge_cents / 100) })}</Caption>}
        {!readOnly && (
          <>
            <Button variant="dangerSoft" size="sm" onClick={() => setConfirmRevoke(true)} style={{ alignSelf: 'flex-start' }}>
              {t('limits.approval.revoke')}
            </Button>
            <ConfirmDialog open={confirmRevoke} danger title={t('limits.approval.revoke')}
              message={t('limits.approval.revoke_confirm')}
              onConfirm={() => revoke.mutate()} onCancel={() => setConfirmRevoke(false)} />
          </>
        )}
        {error && <ErrorBanner variant="subtle">{error}</ErrorBanner>}
      </div>
    )
  }

  if (readOnly) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>{t('limits.approval.title')}</GroupLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ ...captionStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {t('limits.approval.until')}
          {/* Native date input — the one house exception, §3B "the input itself paints in OS locale"; the FACE still follows the shared field style. */}
          <input type="date" value={until} onChange={e => setUntil(e.target.value)}
            style={{ ...fieldInputStyle, height: 34, width: 'auto' }} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Caption>{t('limits.approval.extra_cap')}</Caption>
          <NumberInput value={extraCap} onChange={setExtraCap} min={0} width={100} ariaLabel={t('limits.approval.extra_cap')} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Caption>{t('limits.approval.surcharge')}</Caption>
          <NumberInput value={surchargeEuros} onChange={setSurchargeEuros} min={0} decimals={2} width={100} ariaLabel={t('limits.approval.surcharge')} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('limits.approval.note')}
          aria-label={t('limits.approval.note')} style={{ ...fieldInputStyle, flex: '1 1 160px', width: 'auto' }} />
        <SaveButton saving={grant.isPending} onClick={() => grant.mutate()}>{t('limits.approval.grant')}</SaveButton>
      </div>
      {error && <ErrorBanner variant="subtle">{error}</ErrorBanner>}
    </div>
  )
}
