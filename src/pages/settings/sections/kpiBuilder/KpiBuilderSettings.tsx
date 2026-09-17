/**
 * KpiBuilderSettings — Settings → KPI's → "KPI-bouwer". Mirrors ReportKpiSettings'
 * shell (registry fetch → SubTabBar over the registry's own entities → one panel
 * per active tab, keyed so switching tabs never leaks state). `koios` is hidden
 * (§3 no fake affordance — no report page reads its custom_kpis yet, R9).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { Caption } from '@/components/ui/typography'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useKpiMetrics } from './useKpiMetrics'
import { ENTITIES_WITHOUT_REPORT_SURFACE } from './kpiUnitOptions'
import KpiEntityPanel from './KpiEntityPanel'
import type { KpiEntity } from './kpiDefinitionsApi'

export default function KpiBuilderSettings() {
  const { t } = useTranslation('settings')
  const { data: registry, isLoading, isError, refetch } = useKpiMetrics()
  const entities = (Object.keys(registry ?? {}) as KpiEntity[])
    .filter(entity => !ENTITIES_WITHOUT_REPORT_SURFACE.includes(entity))
  const [active, setActive] = useState<KpiEntity | null>(null)
  const activeEntity = active && entities.includes(active) ? active : entities[0]

  // Registry failure: nothing to build a form from — no list/add can render honestly.
  if (isError) {
    return <ErrorBanner onRetry={() => { void refetch() }}>{t('kpiBuilder.registryError')}</ErrorBanner>
  }
  if (isLoading || !registry) {
    return <Caption as="div">{t('kpiBuilder.loading')}</Caption>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('kpiBuilder.subtitle')}</p>
      <SubTabBar
        tabs={entities.map(entity => ({ id: entity, label: t(`kpiBuilder.entities.${entity}`) }))}
        active={activeEntity}
        onChange={id => setActive(id as KpiEntity)}
      />
      <div style={{ marginTop: 12 }}>
        {activeEntity && registry[activeEntity] && (
          <KpiEntityPanel key={activeEntity} entity={activeEntity} registry={registry[activeEntity]!} />
        )}
      </div>
    </div>
  )
}
