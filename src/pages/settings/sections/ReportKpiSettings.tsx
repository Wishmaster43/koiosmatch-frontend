/**
 * ReportKpiSettings — Settings → Reports → Report cards. Per report, nine fixed
 * slots (never a plus/minus — "which nine, not how many", RAPPORT-KPI-INSTELBAAR).
 * Each slot is reorderable (shared DragList) and swappable via a searchable
 * picker (CreatableSelect, allowCreate={false} — never a native <select>, §3A).
 * Reads catalog from GET /reports/kpi-catalog, selection from GET /reports/kpi-selection/{scope}.
 * Persists to PUT /reports/kpi-selection/{scope} with body {kpis: string[]}.
 *
 * Pinned-first cards render as fixed cards outside the picker (no reorder);
 * available cards show label via label_key with BE label as default fallback.
 */
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import { DragList } from '../components/SettingsControls'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { REPORT_KPI_SCOPE_IDS, REPORT_KPI_FAMILY, resolveReportKpiOrder } from '@/pages/reports/shared'
import type { ReportKpiScopeId } from '@/pages/reports/shared'
import { Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'

// Scope with a known family (axis or fixed) from the catalog.
const CONFIGURABLE_SCOPE_IDS: ReportKpiScopeId[] = REPORT_KPI_SCOPE_IDS.filter(id => REPORT_KPI_FAMILY[id] != null)

interface CatalogEntry {
  key: string
  label: string
  label_key: string
}

interface CatalogScope {
  report: string
  family: 'axis' | 'fixed'
  pinned_first: string | null
  available: CatalogEntry[]
  default: string[]
}

interface CatalogResponse {
  data: Record<string, CatalogScope>
}

interface SelectionResponse {
  data: string[]
}

// The Report cards settings screen: a sub-tab per configurable report scope.
export default function ReportKpiSettings() {
  const { t } = useTranslation('settings')
  const [active, setActive] = useState<ReportKpiScopeId>(CONFIGURABLE_SCOPE_IDS[0])

  // Fetch the full catalog once, used by all scopes.
  const { data: catalogData, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ['reports', 'kpi-catalog'],
    queryFn: async () => {
      const { data } = await api.get<CatalogResponse>('/reports/kpi-catalog')
      return data.data
    },
    staleTime: 60 * 1000,
    retry: 1,
  })

  // Four states on the catalogue itself (§3): a load failure is retryable, never blank.
  if (catalogError) {
    return <ErrorBanner onRetry={() => { void refetchCatalog() }}>{t('common.loadError')}</ErrorBanner>
  }
  if (catalogLoading || !catalogData) {
    return <Caption as="div">{t('reportKpis.loading')}</Caption>
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
        <ReportKpiBlock key={active} scopeId={active} catalogData={catalogData} />
      </div>
    </div>
  )
}

// One scope's editor. Keyed by scope id in the parent so switching tabs never leaks state.
function ReportKpiBlock({ scopeId, catalogData }: { scopeId: ReportKpiScopeId; catalogData: Record<string, CatalogScope> }) {
  const { t } = useTranslation('settings')
  const scopeCatalog = catalogData[scopeId]

  // Fetch selection for this scope.
  const defaultOrder = scopeCatalog?.default ?? []
  const { data: selection = defaultOrder, isLoading: selectionLoading } = useQuery({
    queryKey: ['reports', 'kpi-selection', scopeId],
    queryFn: async () => {
      try {
        const { data } = await api.get<SelectionResponse>(`/reports/kpi-selection/${scopeId}`)
        return data.data
      } catch (err: unknown) {
        const axErr = err as { response?: { status?: number } }
        if (axErr.response?.status === 404) {
          return defaultOrder
        }
        throw err
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    enabled: !!scopeCatalog,
  })

  const [order, setOrder] = useState<string[]>(selection)

  // Sync order when selection loads.
  useEffect(() => {
    setOrder(selection)
  }, [selection])

  // Mutation to save order to the API.
  const { mutate: saveOrder, isPending: saving } = useMutation({
    mutationFn: async (kpis: string[]) => {
      const { data } = await api.put<SelectionResponse>(`/reports/kpi-selection/${scopeId}`, { kpis })
      return data.data
    },
    onSuccess: (newOrder) => {
      setOrder(newOrder)
    },
  })

  if (!scopeCatalog) return <Caption as="div">{t('reportKpis.notFound')}</Caption>

  const pinnedFirst = scopeCatalog.pinned_first
  const availableCards = scopeCatalog.available
  const hasSpares = availableCards.length > defaultOrder.length

  // Detect if the selection contains keys that are no longer in the catalog.
  const { fellBack } = resolveReportKpiOrder(order, availableCards.map(c => c.key), defaultOrder)

  const labelFor = (key: string): string => {
    const entry = availableCards.find(c => c.key === key)
    if (entry) {
      // Try to use i18n label_key; fall back to BE label.
      try {
        return t(entry.label_key, { ns: 'analytics', defaultValue: entry.label })
      } catch {
        return entry.label
      }
    }
    return key
  }

  // Replaces one slot's card via picker.
  const swap = (index: number, newKey: string) => {
    if (order.includes(newKey)) return // no duplicate
    const next = [...order]
    next[index] = newKey
    setOrder(next)
    saveOrder(next)
  }

  // Reorder via drag.
  const handleReorder = (next: { key: string; index: number }[]) => {
    const newOrder = next.map(it => it.key)
    setOrder(newOrder)
    saveOrder(newOrder)
  }

  const items = order.map((key, i) => ({ id: `${key}-${i}`, key, index: i }))

  if (selectionLoading) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('reportKpis.loading')}</p>
  }

  return (
    <div>
      {pinnedFirst && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {t('reportKpis.pinnedFirstNotice', { label: labelFor(pinnedFirst) })}
        </p>
      )}
      {!hasSpares && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {scopeCatalog.family === 'fixed' ? t('reportKpis.noSpareCards') : t('reportKpis.noSpareAxes')}
        </p>
      )}
      {fellBack && (
        <p style={{ fontSize: 12, color: 'var(--color-warning-text)', marginBottom: 8 }}>
          {t('reportKpis.fellBackNotice')}
        </p>
      )}
      <SectionCard title={t('reportKpis.slotsTitle')}>
        <DragList
          items={items}
          onReorder={handleReorder}
          renderItem={(item: { key: string; index: number }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <Caption style={{ width: 20, textAlign: 'right' }}>{item.index + 1}</Caption>
              <div style={{ flex: 1 }}>
                <CreatableSelect
                  value={item.key}
                  allowCreate={false}
                  options={availableCards
                    .filter(c => c.key === item.key || !order.includes(c.key))
                    .map(c => ({ value: c.key, label: labelFor(c.key) }))}
                  onChange={val => swap(item.index, val)}
                />
              </div>
            </div>
          )}
        />
      </SectionCard>
      {saving && <Caption style={{ marginTop: 6 }}>{t('reportKpis.saving')}</Caption>}
    </div>
  )
}
