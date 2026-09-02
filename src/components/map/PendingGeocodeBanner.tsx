/**
 * PendingGeocodeBanner — the ONE calm banner above a map view for rows that have
 * an address but no coordinates yet. Danny 02-09: geocoding runs through the
 * queue after create/import; without this line an empty or half-empty map reads
 * as broken instead of "still processing". Shared across every entity map
 * (candidates, customers, …) rather than re-rolled per page.
 */
import CalloutBox from '@/components/ui/CalloutBox'

export default function PendingGeocodeBanner({ count, label, padded }: {
  count: number
  label: string
  // Mirrors the host map panel's own padded prop so the banner's gutter matches it.
  padded?: boolean
}) {
  // CANON: a counter never renders "0" — no pending rows means no banner at all.
  if (count <= 0) return null

  return (
    <div data-testid="pending-geocode-banner" style={{ padding: padded ? '0 24px' : 0, marginBottom: 6 }}>
      <CalloutBox variant="info">{label}</CalloutBox>
    </div>
  )
}
