/**
 * CatalogSection — the generic settings screen for one catalogue section
 * (DRAFT-SETTINGS-CATALOG-1 §2): the rows marked `ui: 'generic'` render through
 * SchemaSection; dedicated rows stay on their own screens. Four states: loading
 * skeleton, error banner with retry, empty notice, and the form.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SchemaSection from '../components/SchemaSection'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { SkeletonRows } from '../components/SettingsKit'
import { BodyText } from '@/components/ui/typography'
import { useSettingsCatalog } from '../catalog/useSettingsCatalog'
import { catalogToSchema } from '../catalog/catalogToSchema'

interface CatalogSectionProps {
  // Fixed section id from the contract (windows, retention, messaging, email, kpi, …).
  section: string
}

export default function CatalogSection({ section }: CatalogSectionProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { sections, isLoading, isError, refetch } = useSettingsCatalog()

  // The schema is derived once per catalogue load; catalogToSchema drops dedicated rows.
  const schema = useMemo(() => {
    const found = sections.find(s => s.id === section)
    return found ? catalogToSchema(section, found.keys) : null
  }, [sections, section])

  if (isLoading) return <SkeletonRows />
  if (isError) {
    return (
      <ErrorBanner onRetry={() => { void refetch() }} retryLabel={t('common:retry')}>
        {t('common:error.loadFailed')}
      </ErrorBanner>
    )
  }
  if (!schema || schema.fields.length === 0) {
    return <BodyText style={{ padding: '24px 0', color: 'var(--text-muted)' }}>{t('settings:catalog.empty')}</BodyText>
  }
  return <SchemaSection schema={schema} />
}
