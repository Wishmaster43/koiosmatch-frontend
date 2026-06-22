import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocale, useDateFormat } from '../../../lib/datetime'
import DetailTable from '../../../components/ui/DetailTable'

// Titled card wrapper — one per related field group (mirrors the vacancy DetailsTab).
function Card({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

/**
 * DetailsTab — read-only opportunity field grid in titled cards (deal + organisation).
 * The editable axes (stage/owner/customer) live in the header pickers; in-place edit
 * of value/close-date follows in a later round, mirroring the vacancy DetailsTab.
 */
export default function DetailsTab({ opportunity: o }) {
  const { t } = useTranslation('opportunities')
  const locale = useLocale()
  const { formatDate } = useDateFormat()

  // Locale-aware currency for the deal value (falls back to EUR).
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: o.currency || 'EUR', maximumFractionDigits: 0 }),
    [locale, o.currency],
  )

  const deal = [
    [t('details.stage'), o.stage || '—'],
    [t('details.value'), o.value == null ? '—' : money.format(o.value)],
    [t('details.expectedClose'), formatDate(o.expectedCloseAt)],
  ]
  const organisation = [
    [t('details.client'), o.client],
    [t('details.owner'), o.owner || '—'],
    [t('details.created'), formatDate(o.date)],
  ]

  return (
    <div>
      <Card title={t('details.groups.deal')}><DetailTable rows={deal} lastBorder={false} /></Card>
      <Card title={t('details.groups.organisation')}><DetailTable rows={organisation} lastBorder={false} /></Card>
    </div>
  )
}
