import type { Id } from '@/types/common'

/**
 * Shared map view props (CandidatesMapView, VacanciesMapView, CustomersMapView).
 * Thin adapters that map entity rows to MapPoints for the shared RadiusMapPanel.
 */
export interface MapViewProps<Row> {
  rows: Row[]
  center: { lat: number; lng: number }
  radiusKm: number
  onCenterChange: (lat: number, lng: number) => void
  onRadiusChange: (km: number) => void
  // Present while a straal is active — forwards the 'Wis straal' reset.
  onClearRadius?: () => void
  onPick: (id: Id) => void
  // Off when the host embeds the panel in a split (map | table) layout.
  padded?: boolean
}
