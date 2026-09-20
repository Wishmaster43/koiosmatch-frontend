/**
 * GeocodeCard — the OpenCage geocoding card for every entity drawer's Koppelingen tab.
 * Geocoding is a backoffice link like any other, so it belongs in that tab and not as
 * a stray icon in the drawer title row (Danny 28-07: "geocoding must
 * be a tab … it must also disappear from the candidate drill-down, only under
 * Links [Koppelingen]"). The candidate keeps its own richer card (provenance line,
 * record merge); this is the plain version, built on the SAME shared GeocodeButton so
 * the request path is identical everywhere (§3A/§11) and on the SAME useGeocodePoll
 * (GEO-POLL-1) so the card refreshes itself once the queued write lands.
 */
import { useTranslation } from 'react-i18next'
import { Compass } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { Mono, Caption } from '@/components/ui/typography'
import { formatCoord } from '@/lib/formatters'
import { useGeocodePoll } from '@/hooks/useGeocodePoll'

interface GeocodeCardProps {
  // Coordinates as held on the record (already coerced by the mapper — Laravel sends
  // decimals as JSON strings, §10). Null on both = never geocoded.
  lat?: number | null
  lng?: number | null
  /**
   * Per-id geocode route, e.g. `/customers/{id}/geocode`. OMIT it when the entity has no
   * re-geocode route yet (a customer LOCATION: it carries lat/lng and the backend fills
   * them, but there is no POST …/locations/{id}/geocode — measured 28-07, filed as a
   * ticket). The card then shows the coordinates read-only with a one-line reason, which
   * is honest; a button that cannot fire would be a fake affordance (§3).
   */
  endpoint?: string
  /**
   * GET route of the record (e.g. `/customers/{id}`) for the background poll after a
   * queued (202) request — GEO-POLL-1. OMIT it when the entity has no per-id read; the
   * card then only adopts an inline answer.
   */
  fetchEndpoint?: string
  // Write permission for this entity; without it GeocodeButton renders nothing.
  permission: string
  // True when there is no address worth geocoding yet — the caller decides, never this card.
  disabled?: boolean
}

// OpenCage geocoding card for the Koppelingen tab; shows a fresh manual result inline until the host refetches, and degrades to read-only when the entity has no re-geocode route (see file header).
export default function GeocodeCard({ lat, lng, endpoint, fetchEndpoint, permission, disabled }: GeocodeCardProps) {
  const { t } = useTranslation('common')
  // GEO-INLINE-1: an inline answer overrides the (stale) record props at once; a queued
  // answer lands through the poll (GEO-POLL-1) — both through the one hook.
  const poll = useGeocodePoll({ fetchEndpoint: fetchEndpoint ?? null, base: { lat: lat ?? null, lng: lng ?? null, geocode: null } })
  const shownLat = poll.lat
  const shownLng = poll.lng
  const hasCoords = shownLat != null && shownLng != null
  return (
    <SectionCard title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Compass size={16} />
      {t('backofficeLinks.geocode.name')}
    </span>}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        {hasCoords ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SoftChip label={t('backofficeLinks.geocode.linked')} color="var(--color-success)" />
            <Mono style={{ color: 'var(--text-muted)' }}>
              {formatCoord(shownLat)}, {formatCoord(shownLng)}
            </Mono>
          </div>
        ) : (
          <SoftChip label={t('backofficeLinks.geocode.notGeocoded')} color="var(--text-muted)" />
        )}
        {endpoint && <GeocodeButton endpoint={endpoint} permission={permission} disabled={disabled} variant="row"
          onResult={(la, ln) => poll.adopt({ lat: la, lng: ln, geocode: null })} onQueued={poll.start} />}
      </div>
      <Caption style={{ margin: '8px 0 0' }}>
        {endpoint ? t('backofficeLinks.geocode.autoInfo') : t('backofficeLinks.geocode.readOnly')}
      </Caption>
    </SectionCard>
  )
}
