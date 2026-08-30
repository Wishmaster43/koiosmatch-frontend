/**
 * KoiosModelsAdminSettings — superadmin "Koios AI-modellen" screen (K-147 L1+L2).
 * Thin container: fetches the registry once, hands it + a merge-callback down to
 * the four cards, and owns the manual refresh action (POST .../refresh — click
 * only, never automatic, per the brief). Each card PATCHes and saves its own
 * section; this file never writes, it only re-reads what a card just persisted.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { PageTitle, BodyText, Caption } from '@/components/ui/typography'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import SubTabBar, { type SubTab } from '@/components/drawer/SubTabBar'
import { fetchKoiosModelsAdmin, refreshKoiosModelsAdmin } from './koiosmodels/api'
import type { KoiosModelsAdminData } from './koiosmodels/types'
import FlavorsCard from './koiosmodels/FlavorsCard'
import RoutingCard from './koiosmodels/RoutingCard'
import PackagesCard from './koiosmodels/PackagesCard'
import TenantOverridesCard from './koiosmodels/TenantOverridesCard'

type Phase = 'loading' | 'error' | 'empty' | 'ready'
type SubTabId = 'models' | 'packages' | 'routing'

// Thin container (see the module doc above): fetches the registry once, hands it to the four cards, and owns only the manual refresh action — the cards themselves own their own writes.
export default function KoiosModelsAdminSettings() {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [data, setData] = useState<KoiosModelsAdminData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  // Bumped on every successful refresh — the cards' remount key.
  const [dataVersion, setDataVersion] = useState(0)
  // Active sub-tab (Danny 27-08: three sub-tabs read clearer than one long
  // card list). Data stays loaded at this section level regardless of tab,
  // so switching tabs never refetches (§9).
  const [tab, setTab] = useState<SubTabId>('models')
  const TABS: SubTab[] = [
    { id: 'models',   label: t('koiosModelsAdmin.tabs.models') },
    { id: 'packages', label: t('koiosModelsAdmin.tabs.packages') },
    { id: 'routing',  label: t('koiosModelsAdmin.tabs.routing') },
  ]

  // Initial load — abort on unmount/re-run so a slow response never overwrites
  // a later one (§9).
  useEffect(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    fetchKoiosModelsAdmin(ctrl.signal)
      .then(res => {
        setData(res)
        setPhase(res.available?.length ? 'ready' : 'empty')
      })
      .catch(err => {
        if (ctrl.signal.aborted) return
        setError(extractApiError(err, t('koiosModelsAdmin.loadFailed')))
        setPhase('error')
      })
    return () => ctrl.abort()
  }, [t])

  // A card's own PATCH already returned the fresh section — merge it in rather
  // than refetching the whole registry on every save.
  const mergeSaved = useCallback((patch: Partial<KoiosModelsAdminData>) => {
    setData(d => (d ? { ...d, ...patch } : d))
  }, [])

  // The refresh button — the ONLY way this screen re-pulls the vendor model
  // list. Never wired to a mount effect or a timer (brief: click-only).
  const onRefresh = async () => {
    setRefreshing(true); setRefreshError(null)
    try {
      const res = await refreshKoiosModelsAdmin()
      setData(res)
      // Remount the four cards: their drafts seed from useState initializers,
      // which never re-run on a prop change — bumping the version key is what
      // makes the refreshed vendor list actually reach them (Opus round).
      setDataVersion(v => v + 1)
      setPhase(res.available?.length ? 'ready' : 'empty')
    } catch (err) {
      // Own error lane: `phase` stays 'ready', so the phase-gated error block
      // never shows for a failed refresh — this line must render regardless.
      setRefreshError(extractApiError(err, t('koiosModelsAdmin.refreshFailed')))
    }
    setRefreshing(false)
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <PageTitle>{t('koiosModelsAdmin.title')}</PageTitle>
          <BodyText style={{ color: 'var(--text-muted)', marginTop: 2 }}>{t('koiosModelsAdmin.subtitle')}</BodyText>
          {/* Where `available` came from — a fresh vendor pull or the platform's
              own catalogue when nobody has ever refreshed yet (MODELS-PERSIST-1). */}
          {data && (
            <Caption style={{ display: 'block', marginTop: 4 }}>
              {data.available_source === 'live'
                ? t('koiosModelsAdmin.source.live', { at: data.refreshed_at ? formatDateTime(data.refreshed_at) : '—' })
                : t('koiosModelsAdmin.source.catalog')}
            </Caption>
          )}
        </div>
        {/* Catalogue refresh lives with the Models tab (flavour→model map is what it repopulates). */}
        {tab === 'models' && (
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing || phase === 'loading'}>
            {refreshing ? <Spinner size={14} /> : null}
            {t('koiosModelsAdmin.refresh')}
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <SubTabBar tabs={TABS} active={tab} onChange={id => setTab(id as SubTabId)} />
      </div>

      {phase === 'loading' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
          <Spinner size={14} /> {t('koiosModelsAdmin.loading')}
        </div>
      )}

      {phase === 'error' && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>
          {error ?? t('koiosModelsAdmin.loadFailed')}
        </div>
      )}

      {phase === 'empty' && (
        <BodyText style={{ color: 'var(--text-muted)' }}>{t('koiosModelsAdmin.empty')}</BodyText>
      )}

      {refreshError && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 10 }}>
          {refreshError}
        </div>
      )}

      {/* Cards stay mounted only for the active tab, but `data` itself lives above
          this render — switching tabs never re-triggers the load effect. */}
      {phase === 'ready' && data && tab === 'models' && (
        <FlavorsCard key={`f${dataVersion}`} data={data} onSaved={mergeSaved} />
      )}
      {phase === 'ready' && data && tab === 'packages' && (
        <>
          <PackagesCard key={`p${dataVersion}`} data={data} onSaved={mergeSaved} />
          <TenantOverridesCard key={`t${dataVersion}`} data={data} onSaved={mergeSaved} />
        </>
      )}
      {phase === 'ready' && data && tab === 'routing' && (
        <RoutingCard key={`r${dataVersion}`} data={data} onSaved={mergeSaved} />
      )}
    </div>
  )
}
