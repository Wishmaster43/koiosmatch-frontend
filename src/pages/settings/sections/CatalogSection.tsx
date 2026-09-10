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
  // CATALOG-GROUPS-1: rendered under a dedicated screen (company, action_rules, …) —
  // no page title of its own, the grouped blocks and the Save bar only.
  embedded?: boolean
}

export default function CatalogSection({ section, embedded = false }: CatalogSectionProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { sections, isLoading, isError, refetch } = useSettingsCatalog()

  // The schema is derived once per catalogue load; catalogToSchema drops dedicated rows.
  const schema = useMemo(() => {
    const found = sections.find(s => s.id === section)
    // A section the BE hides has no generic screen — it reads as empty, never as raw rows.
    return found && !found.hidden ? catalogToSchema(section, found.keys, { groups: found.groups, color: found.color }) : null
  }, [sections, section])

  if (isLoading) return <SkeletonRows />
  if (isError) {
    return (
      <ErrorBanner onRetry={() => { void refetch() }} retryLabel={t('common:error.retry')}>
        {t('common:error.loadFailed')}
      </ErrorBanner>
    )
  }
  if (!schema || schema.fields.length === 0) {
    // An embedded block with nothing generic to show renders nothing — the host screen stands on its own.
    return embedded ? null : <BodyText style={{ padding: '24px 0', color: 'var(--text-muted)' }}>{t('settings:catalog.empty')}</BodyText>
  }
  return <SchemaSection schema={schema} embedded={embedded} />
}
