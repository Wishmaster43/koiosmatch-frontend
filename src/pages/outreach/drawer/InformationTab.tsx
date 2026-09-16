/**
 * InformationTab — the campaign's own INFORMATIE block (DRILLDOWN-VOLGORDE-CANON,
 * §3A: information cards come first in every drill-down). Name and channel are
 * editable (PATCH via useOutreachDetail.setFields); source pool and created-at
 * are read-only — the pool is only a seeding source at creation time and the
 * creation date is not user-editable data.
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { targetGroupNameOf } from '../data/outreachCampaignFields'
import type { CampaignDetail } from '../hooks/useOutreachDetail'

// Fixed backend enum (mirrors OutreachCreate) — not a tenant lookup.
const CHANNELS = ['call', 'email', 'whatsapp'] as const

interface Props {
  detail: CampaignDetail | null
  loading: boolean
  error: boolean
  onRetry: () => void
  onSave: (patch: { name?: string; channel?: string }) => void
}

// The campaign's own field card — first tab in the canonical drill-down order.
// Four UI states explicit (§16): a failed/still-loading GET must never let the
// EditableFieldTable seed its draft from invented empties and PATCH them over
// real data.
export default function InformationTab({ detail, loading, error, onRetry, onSave }: Props) {
  const { t } = useTranslation('outreach')

  if (error) return <ErrorBanner onRetry={onRetry}>{t('drawer.error')}</ErrorBanner>
  if (loading || !detail) return <Spinner />

  const fields: FieldRow[] = [
    { key: 'name', label: t('drawer.fields.name') },
    { key: 'channel', label: t('drawer.fields.channel'), type: 'select',
      options: CHANNELS.map(c => ({ value: c, label: t(`channel.${c}`) })) },
    { key: 'pool', label: t('drawer.fields.pool'), readOnly: true },
    { key: 'createdAt', label: t('drawer.fields.createdAt'), type: 'date', readOnly: true },
  ]

  const values = {
    name: detail.name ?? '',
    channel: detail.channel ?? 'call',
    pool: targetGroupNameOf(detail) || t('create.poolNone'),
    createdAt: detail.created_at ?? '',
  }

  return (
    <EditableFieldTable
      fields={fields}
      value={values}
      onSave={v => onSave({ name: v.name as string, channel: v.channel as string })}
    />
  )
}
