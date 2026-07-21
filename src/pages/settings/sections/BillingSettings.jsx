/** Billing sections — only Facturen remains as a placeholder tab. Plan management,
 * payment methods and auto top-up are all intentionally GONE (Danny 21-07: dead
 * placeholder screens, matching the R-1 decision to drop the payment/top-up flow).
 * GebruikSettings (usage) lives in its own file `./GebruikSettings.jsx`. */
import { useTranslation } from 'react-i18next'
import PlaceholderSettings from './PlaceholderSettings'

export function FacturenSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('billing.invoices.title')} description={t('billing.invoices.desc')} />
}
