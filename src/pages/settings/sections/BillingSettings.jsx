/** Billing sections — currently placeholders (plan, payment methods, invoices).
 * One component per nav tab; all driven by i18n. Auto top-up (opwaarderen) is
 * intentionally GONE (Danny 21-07: "weg, doen we niets meer"), matching the R-1
 * decision to drop the payment/top-up flow. GebruikSettings (usage) moved to its
 * own file `./GebruikSettings.jsx` — a real, data-driven section. */
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
export function FacturenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.invoices.title')} description={t('billing.invoices.desc')} />
}
