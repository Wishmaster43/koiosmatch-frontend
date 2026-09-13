/**
 * EmailGeneralSettings — Settings → Communicatie → E-mail algemeen (CATALOG-EMBED-1,
 * Danny 13-09: "Inbox mail hoort bij email instellingen"). A small host screen: its
 * own page title, then the catalogue's "email"/mail group (the default from-address
 * + the pattern-family placeholder rows) and the "messaging"/inbox group (the
 * inbox's default message-load window) as two titled blocks — both replace the
 * retired catalog/email and catalog/messaging nav screens.
 */
import { useTranslation } from 'react-i18next'
import { PageTitle, BodyText } from '@/components/ui/typography'
import CatalogSection from './CatalogSection'

// Merges two catalogue groups from different sections onto one screen — neither
// group alone justifies its own top-level nav item, and both are e-mail-shaped.
export default function EmailGeneralSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <PageTitle>{t('emailGeneral.title')}</PageTitle>
        <BodyText style={{ color: 'var(--text-muted)', marginTop: 2 }}>{t('emailGeneral.subtitle')}</BodyText>
      </div>
      <CatalogSection section="email" group="mail" embedded />
      <div style={{ marginTop: 24 }}><CatalogSection section="messaging" group="inbox" embedded /></div>
    </div>
  )
}
