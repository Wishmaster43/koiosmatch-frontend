/**
 * GeocodeCard — the OpenCage geocoding card for every entity drawer's Koppelingen tab.
 * Geocoding is a backoffice link like any other, so it belongs in that tab and not as
 * a stray icon in the drawer title row (Danny 28-07: "FRESH PDOK moet tabblad zijn …
 * MOET OOK WEG BIJ KANDIDAAT DRILL DOWN, alleen bij koppelingen" — "geocoding must
 * be a tab … it must also disappear from the candidate drill-down, only under
 * Links [Koppelingen]"). The candidate keeps its own richer card (it polls for fresh
 * coordinates after a manual refresh); this is the plain version for entities without
 * that polling, built on the SAME shared GeocodeButton so the request path is
 * identical everywhere (§3A/§11).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Compass } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { Mono, Caption } from '@/components/ui/typography'

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
  // Write permission for this entity; without it GeocodeButton renders nothing.
  permission: string
  // True when there is no address worth geocoding yet — the caller decides, never this card.
  disabled?: boolean
}

// OpenCage geocoding card for the Koppelingen tab; shows a fresh manual result inline until the host refetches, and degrades to read-only when the entity has no re-geocode route (see file header).
export default function GeocodeCard({ lat, lng, endpoint, permission, disabled }: GeocodeCardProps) {
  const { t } = useTranslation('common')
  // GEO-INLINE-1: a manual re-geocode answers inline now — the fresh result
  // overrides the (stale) record props until the host refetches.
  const [fresh, setFresh] = useState<{ lat: number; lng: number } | null>(null)
  const shownLat = fresh?.lat ?? lat
  const shownLng = fresh?.lng ?? lng
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
              {shownLat?.toFixed(5)}, {shownLng?.toFixed(5)}
            </Mono>
          </div>
        ) : (
          <SoftChip label={t('backofficeLinks.geocode.notGeocoded')} color="var(--text-muted)" />
        )}
        {endpoint && <GeocodeButton endpoint={endpoint} permission={permission} disabled={disabled} variant="row"
          onResult={(la, ln) => setFresh({ lat: la, lng: ln })} />}
      </div>
      <Caption style={{ margin: '8px 0 0' }}>
        {endpoint ? t('backofficeLinks.geocode.autoInfo') : t('backofficeLinks.geocode.readOnly')}
      </Caption>
    </SectionCard>
  )
}
