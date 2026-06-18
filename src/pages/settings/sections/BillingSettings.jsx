/** Billing sections — currently placeholders (plan, payment methods, auto top-up,
 * usage, invoices). One component per nav tab; all driven by i18n. */
import { useTranslation } from 'react-i18next'
import PlaceholderSettings from './PlaceholderSettings'

export function PlanbeheerSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.plans.title')} description={t('billing.plans.desc')} />
}
export function BetaalmethodenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.pay.title')} description={t('billing.pay.desc')} />
}
export function AutoOpwaarderenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.auto.title')} description={t('billing.auto.desc')} />
}
export function GebruikSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.usage.title')} description={t('billing.usage.desc')} />
}
export function FacturenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.invoices.title')} description={t('billing.invoices.desc')} />
}
