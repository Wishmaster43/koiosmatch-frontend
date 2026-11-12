/**
 * ProposalCvPicker — choose which saved proposal CV an `application_propose`
 * action item sends (Y-002). Shared by the note panel and the rich-text card
 * (one picker, two renderers). Choosing nothing is allowed: the server declines
 * with proposal_cv_required and the decline face explains it.
 */
import { useTranslation } from 'react-i18next'
import SearchSelect from '../SearchSelect'
import { Caption } from '../typography'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'
import { useProposalCvDocuments } from './useProposalCvDocuments'


interface ProposalCvPickerProps {
  applicationId: Id | null | undefined
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  // Bumped by the host after Koios stored a new CV, so the list re-reads.
  refreshKey?: unknown
}

// Four states: loading caption, error caption, empty hint, or the clearable single-pick list.
export default function ProposalCvPicker({ applicationId, value, onChange, disabled, refreshKey }: ProposalCvPickerProps) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  const { docs, loading, error } = useProposalCvDocuments(applicationId, refreshKey)
  // Without an application link there is nothing to pick from: render nothing rather than a misleading "no CV yet".
  if (!applicationId) return null

  if (loading) return <Caption as="div">{t('common:loading')}</Caption>
  if (error) return <Caption as="div">{t('notesAssist.proposeCv.loadError')}</Caption>
  if (docs.length === 0) return <Caption as="div">{t('notesAssist.proposeCv.none')}</Caption>

  // Option label carries the upload date (DD-MM-YYYY via the house formatter) when known.
  const options = docs.map(d => ({ value: d.id, label: d.uploadedAt ? `${d.label} · ${formatDate(d.uploadedAt)}` : d.label }))
  const picked = options.find(o => o.value === value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Caption as="div">{t('notesAssist.proposeCv.label')}</Caption>
      <SearchSelect
        triggerLabel={picked?.label ?? t('notesAssist.proposeCv.placeholder')}
        options={options} selected={value ? [value] : []} selectAll={false} closeOnToggle disabled={disabled}
        onToggle={(v: string) => onChange(v === value ? null : v)}
        onClear={() => onChange(null)} />
    </div>
  )
}
