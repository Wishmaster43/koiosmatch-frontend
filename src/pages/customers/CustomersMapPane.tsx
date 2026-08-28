/**
 * CustomersMapPane — the map ⇄ table split view (STRAAL-1). Map left, the
 * same server-filtered rows as a table right. Pure extraction from
 * CustomersPage (§0.3 split) — no behavior change.
 */
import { Suspense, lazy } from 'react'
import type { TFunction } from 'i18next'
import ErrorBanner from '@/components/ui/ErrorBanner'
import PaginationBar from '@/components/ui/PaginationBar'
import CustomersTable from './CustomersTable'
import type { Customer } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const CustomersMapView = lazy(() => import('./CustomersMapView'))

interface Props {
  t: TFunction
  rows: Customer[]
  loading: boolean
  error: string | null
  selectedId?: Id
  onSelect: (row: Customer, tab?: string) => void
  statusMeta: (v?: string | null) => LookupOption
  mapCenter: { lat: number; lng: number }
  mapRadius: number
  setMapCenter: (c: { lat: number; lng: number }) => void
  setMapRadius: (r: number) => void
  page: number
  lastPage: number
  total: number
  pageSize: number
  pageSizeOptions: number[]
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

// Map view: Leaflet pane (left) + the same filtered rows as a table (right) — one radius search drives both panes.
export default function CustomersMapPane({
  t, rows, loading, error, selectedId, onSelect, statusMeta, mapCenter, mapRadius, setMapCenter, setMapRadius,
  page, lastPage, total, pageSize, pageSizeOptions, onPageChange, onPageSizeChange,
}: Props) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 24px 16px' }}>
      <div style={{ flex: '1.1 1 0', minWidth: 400, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:map.loading')}</div>}>
          <CustomersMapView rows={rows} padded={false}
            statusColor={v => statusMeta(String(v)).color} center={mapCenter} radiusKm={mapRadius}
            onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} onRadiusChange={setMapRadius}
            onPick={id => onSelect({ id } as Customer)} />
        </Suspense>
      </div>
      {/* Right pane: the same server-filtered rows as a table (row click = drawer). */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {error && (
            <ErrorBanner style={{ marginBottom: 12 }}>{error}</ErrorBanner>
          )}
          <CustomersTable rows={rows} loading={loading} selectedId={selectedId}
            onSelect={onSelect} onOpenTab={onSelect} statusMeta={statusMeta} />
        </div>
        <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={pageSize}
          onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} pageSizeOptions={pageSizeOptions} />
      </div>
    </div>
  )
}
