/**
 * PdokCard — the PDOK geocoding card for every entity drawer's Koppelingen tab.
 * Geocoding is a backoffice link like any other, so it belongs in that tab and not as
 * a stray icon in the drawer title row (Danny 28-07: "FRESH PDOK moet tabblad zijn …
 * MOET OOK WEG BIJ KANDIDAAT DRILL DOWN, alleen bij koppelingen" — "FRESH PDOK must
 * be a tab … it must also disappear from the candidate drill-down, only under
 * Links [Koppelingen]"). The candidate keeps
 * its own richer card (it polls for fresh coordinates after a manual refresh); this is
 * the plain version for entities without that polling, built on the SAME shared
 * GeocodeButton so the request path is identical everywhere (§3A/§11).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { CardTitle } from '@/components/drawer/BackofficeLinksTab'
import pdokIcon from '@/assets/integrations/pdok.png'

interface PdokCardProps {
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

// Plain PDOK geocode card for the Koppelingen tab; shows a fresh manual result inline until the host refetches, and degrades to read-only when the entity has no re-geocode route (see file header).
export default function PdokCard({ lat, lng, endpoint, permission, disabled }: PdokCardProps) {
  const { t } = useTranslation('common')
  // GEO-INLINE-1: a manual re-geocode answers inline now — the fresh result
  // overrides the (stale) record props until the host refetches.
  const [fresh, setFresh] = useState<{ lat: number; lng: number } | null>(null)
  const shownLat = fresh?.lat ?? lat
  const shownLng = fresh?.lng ?? lng
  const hasCoords = shownLat != null && shownLng != null
  return (
    <SectionCard title={<CardTitle icon={pdokIcon} alt={t('backofficeLinks.pdok.alt')} label={t('backofficeLinks.pdok.name')} />}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        {hasCoords ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SoftChip label={t('backofficeLinks.pdok.linked')} color="var(--color-success)" />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
              {shownLat?.toFixed(5)}, {shownLng?.toFixed(5)}
            </span>
          </div>
        ) : (
          <SoftChip label={t('backofficeLinks.pdok.notGeocoded')} color="var(--text-muted)" />
        )}
        {endpoint && <GeocodeButton endpoint={endpoint} permission={permission} disabled={disabled} variant="row"
          onResult={(la, ln) => setFresh({ lat: la, lng: ln })} />}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        {endpoint ? t('backofficeLinks.pdok.autoInfo') : t('backofficeLinks.pdok.readOnly')}
      </p>
    </SectionCard>
  )
}
