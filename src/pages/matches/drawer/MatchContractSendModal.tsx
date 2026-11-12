/**
 * MatchContractSendModal — HF-CONTRACT-1: the CONFIRM face of "send contract to
 * HelloFlex". The server builds the contract from the STORED match, so this shows a
 * read-only summary (label left, value right) of what will be sent and one send
 * button; missing values are flagged but never block, the server decides.
 * Financial data (§7/§8): nothing is logged, stored or toasted here.
 */
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ReasonModalHeader from '@/components/ui/ReasonModalHeader'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { BodyText, Caption } from '@/components/ui/typography'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import MatchConfirmFooter from './MatchConfirmFooter'
import { useState } from 'react'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { notifySuccess } from '@/lib/notify'
import { useContractSend } from '../hooks/useContractSend'
import { useMatchContract } from '../hooks/useMatchContract'
import type { MatchRow } from '@/types/match'

interface Props {
  match: MatchRow
  onClose: () => void
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

// One read-only summary row: label left, value right, italic caption when the value is missing.
function SummaryRow({ label, value, missing, flagMissing }: { label: string; value: string | null; missing: string; flagMissing?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <BodyText style={{ flex: 1, minWidth: 0 }}>
        {value ?? (flagMissing ? <Caption style={{ fontStyle: 'italic' }}>{missing}</Caption> : '—')}
      </BodyText>
    </div>
  )
}

export default function MatchContractSendModal({ match, onClose, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  const { send, sending } = useContractSend(match.id)
  const { data, loading, error } = useMatchContract(match.id)
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const [banner, setBanner] = useState<string | null>(null)

  // Values come from the detail read, with the list row as the fallback. HelloFlex resolves its
  // contract type from the CONTRACT FORM (the Contractvorm axis, ContractPayloadBuilder), never
  // from the separate contract_type "soort" axis, so that is the value the summary shows.
  const contractForm = data.contractForm?.label ?? match.contractForm?.label ?? null
  const functionTitle = data.function_title ?? match.functionTitle ?? null
  const startDate = data.start_date ?? match.startDate ?? null
  const endDate = data.end_date ?? match.endDate ?? null
  const someMissing = !contractForm || !functionTitle || !startDate

  // Sends the stored match (no body); success refreshes the row, failure shows the mapped sentence.
  const submit = async () => {
    if (sending) return
    setBanner(null)
    const out = await send()
    if (out.ok) {
      onUpdate?.(match.id, { contractStatus: out.data.contract_status ?? 'sent', helloflexContractGuid: out.data.guid ?? match.helloflexContractGuid ?? null })
      notifySuccess(t('drawer.contractSend.success'))
      onClose()
      return
    }
    setBanner(out.message ?? Object.values(out.fieldErrors)[0] ?? t('drawer.contractSend.error'))
  }

  const missing = t('drawer.contractSend.missing')
  return (
    <FloatingPanel open onClose={onClose} ariaLabel={t('drawer.contractSend.title')}
      persistKey="match-contract-send" width={560} maxWidth="94vw" bodyStyle={{ padding: 20 }}
      header={<ReasonModalHeader icon={FileText} iconBg="var(--color-primary-bg)"
        iconColor="var(--color-primary-text)" title={t('drawer.contractSend.title')} titleWeight={700} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BodyText>{t('drawer.contractSend.intro')}</BodyText>
        {loading && <Spinner label={t('common:loading')} />}
        {error && <ErrorBanner>{t('drawer.contractSend.error')}</ErrorBanner>}
        {!loading && !error && (
          <>
            <SummaryRow label={t('drawer.contractSend.contractForm')} value={contractForm} missing={missing} flagMissing />
            <SummaryRow label={t('drawer.contractSend.functionTitle')} value={functionTitle} missing={missing} flagMissing />
            <SummaryRow label={t('drawer.contractSend.startDate')} value={startDate ? formatDate(startDate) : null} missing={missing} flagMissing />
            <SummaryRow label={t('drawer.contractSend.endDate')} value={endDate ? formatDate(endDate) : null} missing={missing} />
            <SummaryRow label={t('drawer.contractSend.hoursPerWeek')} value={data.hours_per_week != null ? formatNumber(Number(data.hours_per_week)) : null} missing={missing} />
            <SummaryRow label={t('drawer.contractSend.costCenter')} value={data.cost_center} missing={missing} />
            <SummaryRow label={t('drawer.contractSend.purchaseOrderNumber')} value={data.purchase_order_number} missing={missing} />
            {someMissing && <Caption>{t('drawer.contractSend.fillOnOverview')}</Caption>}
          </>
        )}
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
      </div>
      <MatchConfirmFooter onCancel={onClose} cancelLabel={t('common:cancel')} onSubmit={submit}
        submitLabel={t('drawer.contractSend.submit')} disabled={sending} />
    </FloatingPanel>
  )
}
