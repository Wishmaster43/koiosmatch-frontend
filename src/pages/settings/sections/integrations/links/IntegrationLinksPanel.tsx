/**
 * IntegrationLinksPanel (MAPPING-TABLE-FE-1) — container for the "Links" sub-tab of a
 * connector: debounced search, right-panel filters (type limited to what the viewer
 * may see, status), pagination and the save mutation. The system is preset by the
 * connector tab and is never a user filter.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import HeaderSearch from '@/components/ui/HeaderSearch'
import PaginationBar from '@/components/ui/PaginationBar'
import Button from '@/components/ui/Button'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import { PageTitle, Caption } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import IntegrationLinksTable from './IntegrationLinksTable'
import { useIntegrationLinks } from './useIntegrationLinks'
import { putLink } from './linksApi'
import { LINK_TYPE_PERMISSION } from './linkTargets'
import type { LinkEntityType, LinkRow, LinkSystem } from './linksApi'

// Every link type, and the status values the filter offers.
const ALL_TYPES = Object.keys(LINK_TYPE_PERMISSION) as LinkEntityType[]
const STATUSES = ['linked', 'pending', 'syncing', 'failed', 'unlinked'] as const
type StatusFilter = (typeof STATUSES)[number]

export default function IntegrationLinksPanel({ system }: { system: LinkSystem }) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { registerFilters, unregisterFilters } = useRightPanel()
  const [search, setSearch] = useState('')
  // Bumping the epoch remounts the uncontrolled HeaderSearch so clear-filters empties it too.
  const [searchEpoch, setSearchEpoch] = useState(0)
  const [types, setTypes] = useState<LinkEntityType[]>([])
  const [status, setStatus] = useState<StatusFilter | undefined>()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

  // Only the types the viewer may see are offered (the server hides the rest anyway).
  const permittedTypes = useMemo(
    () => ALL_TYPES.filter((ty) => auth?.hasPermission(LINK_TYPE_PERMISSION[ty])), [auth])
  const canEdit = auth?.hasPermission('settings.update') ?? false

  const query = useIntegrationLinks({ system, entityTypes: types, status, search, page, perPage })

  // Register the type + status groups in the shared right panel; unregister on unmount.
  const filterGroups = useMemo(() => [
    { key: 'type', label: t('integrations.links.columns.type'), type: 'search-select', selected: types,
      options: permittedTypes.map((v) => ({ value: v, label: t(`integrations.links.types.${v}`) })),
      onToggle: (v: LinkEntityType) => { setPage(1); setTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])) } },
    { key: 'status', label: t('integrations.links.columns.status'), type: 'search-select', selected: status ? [status] : [],
      options: STATUSES.map((v) => ({ value: v, label: t(`integrations.links.status.${v}`) })),
      // The server takes ONE status: picking another replaces, picking the same clears.
      onToggle: (v: StatusFilter) => { setPage(1); setStatus((p) => (p === v ? undefined : v)) } },
  ], [t, types, status, permittedTypes])
  useEffect(() => {
    registerFilters(`integration-links-${system}`, filterGroups as Parameters<typeof registerFilters>[1])
    return () => unregisterFilters(`integration-links-${system}`)
  }, [system, filterGroups, registerFilters, unregisterFilters])

  // Persist one link edit, then refresh the list; failures toast and rethrow so the row keeps its draft.
  const onSave = useCallback(async (row: LinkRow, externalId: string | null) => {
    try {
      await putLink({ entity_type: row.entity_type, entity_id: row.entity_id, system, external_id: externalId })
      notifySuccess(t('integrations.links.saved'))
      await queryClient.invalidateQueries({ queryKey: ['integration-links'] })
    } catch (err) {
      notifyError(extractApiError(err, t('integrations.links.saveError')))
      throw err
    }
  }, [system, queryClient, t])

  const filtersActive = types.length > 0 || status != null || search !== ''
  const data = query.data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <PageTitle>{t('integrations.links.title')}</PageTitle>
        <Caption as="p" style={{ marginTop: 2 }}>{t('integrations.links.subtitle')}</Caption>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <HeaderSearch key={searchEpoch} placeholder={t('integrations.links.searchPlaceholder')} onSearch={(q) => { setPage(1); setSearch(q) }} />
        <ClearFiltersButton active={filtersActive}
          onClear={() => { setTypes([]); setStatus(undefined); setSearch(''); setSearchEpoch((n) => n + 1); setPage(1) }} />
      </div>
      {query.isError ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Caption as="p" style={{ color: 'var(--color-danger-text)' }}>{t('integrations.links.loadError')}</Caption>
          <Button variant="secondary" onClick={() => query.refetch()}>{t('common:error.retry')}</Button>
        </div>
      ) : (
        <>
          <IntegrationLinksTable rows={data?.rows ?? []} loading={query.isLoading || query.isFetching} canEdit={canEdit} onSave={onSave} />
          {data && data.total > 0 && (
            <PaginationBar page={data.page} totalPages={data.lastPage} totalRows={data.total} pageSize={perPage}
              onPageChange={setPage} onPageSizeChange={(n) => { setPerPage(n); setPage(1) }} />
          )}
        </>
      )}
    </div>
  )
}
