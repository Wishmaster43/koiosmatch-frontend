import { useTranslation } from 'react-i18next'
import PlaceholderSettings from './PlaceholderSettings'

export default function AppStoreSettings() {
  const { t } = useTranslation('settings')
  return <PlaceholderSettings title={t('appStore.title')} description={t('appStore.desc')} />
}
