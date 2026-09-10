// The "no location" map-pane notice shared by pages/candidates/drawer/
// VacancySearchTab and pages/vacancies/drawer/CandidateSearchTab: a dashed
// border box with a message and a GeocodeButton trigger. Endpoint, permission
// and disabled state travel as props; the message arrives already resolved
// (rule C — no i18n key lives in this shared unit) (DRY round 11, SEARCHTABS).
import GeocodeButton from '@/components/ui/GeocodeButton'

export default function GeocodeMissingRow({
  message, endpoint, permission, disabled,
}: {
  message: string
  // Per-id geocode route, e.g. `/candidates/{id}/geocode` (GeocodeButton's own contract).
  endpoint: string
  permission: string
  // Caller-set: true when there is nothing meaningful to geocode (no address on record).
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, border: '1px dashed var(--border)', borderRadius: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{message}</span>
      <GeocodeButton endpoint={endpoint} permission={permission} variant="row" disabled={disabled} />
    </div>
  )
}
