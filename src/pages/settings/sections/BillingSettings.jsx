/** Billing sections — currently placeholders (plan, payment methods, auto top-up,
 * invoices). One component per nav tab; all driven by i18n.
 * GebruikSettings (usage) moved to its own file `./GebruikSettings.jsx` — it grew
 * into a real, data-driven section and no longer belongs next to these placeholders. */
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
export function FacturenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.invoices.title')} description={t('billing.invoices.desc')} />
}
