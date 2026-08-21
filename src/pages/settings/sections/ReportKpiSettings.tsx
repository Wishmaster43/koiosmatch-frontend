/**
 * ReportKpiSettings — Settings → Reports → Report cards. Per report, nine fixed
 * slots (never a plus/minus — "which nine, not how many", RAPPORT-KPI-INSTELBAAR).
 * Each slot is reorderable (shared DragList) and swappable via a searchable
 * picker (CreatableSelect, allowCreate={false} — never a native <select>, §3A).
 * Persisted one JSON key per report (`report_kpis_<id>`) through the shared
 * free-form settings blob — no backend change needed (design doc §3/§5).
 *
 * Axis-family reports (candidates/applications/customers) offer their fixed axis
 * list as the catalogue, with card 1 ("total") pinned and out of the picker.
 * Fixed-family reports currently have no spare cards beyond their own nine — the
 * picker still lets a tenant reorder, but honestly says there is nothing else to
 * swap in yet (design doc: honest beats decorative) via `reportHasSpareKpiCards`.
 */
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import { DragList } from '../components/SettingsControls'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { REPORT_KPI_SCOPE_IDS, REPORT_KPI_FAMILY, REPORT_KPI_PINNED_FIRST, getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards, reportKpiSettingsKey } from '@/pages/reports/shared'
import type { ReportKpiScopeId } from '@/pages/reports/shared'
import { resolveReportKpiOrder } from '@/pages/reports/shared'
import { Caption } from '@/components/ui/typography'

// Only scopes with a known catalogue (axis or fixed) get a block — a scope
// without a ReportKpiBand strip has nothing to configure here. Scopes are the
// consolidation-proof identity (RAPPORTEN-CONSOLIDATIE-1): every switch
// position on a merged page (Leads, Prospects, Recruiters/Accountmanagers,
// Contacts/Locations/Departments, AI/Workflows) keeps its own tab here even
// though several no longer have their own top-level route — see kpiCatalog.ts.
const CONFIGURABLE_SCOPE_IDS: ReportKpiScopeId[] = REPORT_KPI_SCOPE_IDS.filter(id => REPORT_KPI_FAMILY[id] != null)

export default function ReportKpiSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  const loaded = useSettingsLoaded()
  const [active, setActive] = useState<ReportKpiScopeId>(CONFIGURABLE_SCOPE_IDS[0])

  if (!loaded) {
    return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>{t('reportKpis.loading')}</div>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('reportKpis.intro')}</p>
      <SubTabBar
        tabs={CONFIGURABLE_SCOPE_IDS.map(id => ({ id, label: t(`reportKpis.reportNames.${id}`) }))}
        active={active}
        onChange={id => setActive(id as ReportKpiScopeId)}
      />
      <div style={{ marginTop: 12 }}>
        <ReportKpiBlock key={active} reportId={active} values={values} />
      </div>
    </div>
  )
}

// One scope's nine-slot editor. Keyed by scope id in the parent so switching
// tabs never leaks local drag/save state between scopes.
function ReportKpiBlock({ reportId, values }: { reportId: ReportKpiScopeId; values: Record<string, unknown> }) {
  const { t } = useTranslation('settings')
  const family = REPORT_KPI_FAMILY[reportId]
  const catalog = getReportKpiCatalog(reportId)
  const defaultOrder = getReportKpiDefaultOrder(reportId)
  const pinnedFirst = REPORT_KPI_PINNED_FIRST[reportId]
  const hasSpares = reportHasSpareKpiCards(reportId)
  const settingsKey = reportKpiSettingsKey(reportId)

  const stored = getJsonSetting<string[] | undefined>(values, settingsKey, undefined)
  const { order: resolved, fellBack } = resolveReportKpiOrder(stored, catalog.map(c => c.key), defaultOrder)
  const [order, setOrder] = useState<string[]>(resolved)
  const [saving, setSaving] = useState(false)

  const labelFor = (key: string): string => {
    const entry = catalog.find(c => c.key === key)
    return entry ? t(entry.labelKey, { ns: 'analytics' }) : key
  }

  const persist = async (next: string[]) => {
    setOrder(next)
    setSaving(true)
    try {
      await saveSettingsKeys({ [settingsKey]: next })
    } finally {
      setSaving(false)
    }
  }

  const swap = (index: number, newKey: string) => {
    if (order.includes(newKey)) return // no duplicate card twice in one report
    const next = [...order]
    next[index] = newKey
    persist(next)
  }

  const items = order.map((key, i) => ({ id: `${key}-${i}`, key, index: i }))

  return (
    <div>
      {pinnedFirst && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {t('reportKpis.pinnedFirstNotice', { label: labelFor(pinnedFirst) })}
        </p>
      )}
      {!hasSpares && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {family === 'fixed' ? t('reportKpis.noSpareCards') : t('reportKpis.noSpareAxes')}
        </p>
      )}
      {fellBack && (
        <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 8 }}>
          {t('reportKpis.fellBackNotice')}
        </p>
      )}
      <SectionCard title={t('reportKpis.slotsTitle')}>
        <DragList
          items={items}
          onReorder={(next: { key: string; index: number }[]) => persist(next.map(it => it.key))}
          renderItem={(item: { key: string; index: number }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <Caption style={{ width: 20, textAlign: 'right' }}>{item.index + 1}</Caption>
              <div style={{ flex: 1 }}>
                <CreatableSelect
                  value={item.key}
                  allowCreate={false}
                  options={catalog
                    .filter(c => c.key === item.key || !order.includes(c.key))
                    .map(c => ({ value: c.key, label: t(c.labelKey, { ns: 'analytics' }) }))}
                  onChange={val => swap(item.index, val)}
                />
              </div>
            </div>
          )}
        />
      </SectionCard>
      {saving && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('reportKpis.saving')}</p>}
    </div>
  )
}
