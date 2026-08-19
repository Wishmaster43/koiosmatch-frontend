/**
 * LocationsTable — the branch (vestiging) list itself: one row per location with
 * its identity badge, composed address, creation moment and row actions
 * (re-geocode / edit / delete), plus the pager underneath.
 *
 * Purely presentational: it owns HOW a location row looks and nothing else. All
 * data, the current page and every mutation live in LocationsSettings, which is
 * why this file has no api/notify imports — pulled out of that container (28-07)
 * so the container is left with loading, CRUD and the table↔map switch.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import GeocodeButton from '@/components/ui/GeocodeButton'
import Spinner from '@/components/ui/Spinner'
import LocationBadge from './LocationBadge'

const TH = { padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }
const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

// One address line from the structured fields, falling back to a legacy
// `address`/`full_address` string the API may still send instead.
function formatAddress(loc) {
  if (loc.address)      return loc.address
  if (loc.full_address) return loc.full_address
  const streetLine = [loc.street, loc.house_number].filter(Boolean).join(' ')
    + (loc.house_number_suffix ? ` ${loc.house_number_suffix}` : '')
  const cityLine = [loc.postal_code, loc.city].filter(Boolean).join(' ')
  const parts = [streetLine.trim(), cityLine.trim(), loc.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

export default function LocationsTable({ isLocked, rows, page, totalPages, onPageChange, onEdit, onDelete, deletingId }) {
  const { t } = useTranslation(['settings', 'common'])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>{t('locations.colName')}</th>
            <th style={TH}>{t('locations.colAddress')}</th>
            <th style={TH}>{t('locations.colCreated')}</th>
            <th style={{ ...TH, textAlign: 'right' }}>{t('locations.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>{t('locations.empty')}</td></tr>
          ) : rows.map((loc, i) => {
            // Whether this branch is still referenced comes from the CONTAINER, which owns
            // that rule and also guards the delete handler with it. Re-deriving it here
            // from the raw flag was two truths for one backend rule: rename the field and
            // only one of them follows, leaving an enabled button whose handler silently
            // does nothing (verification finding, 28-07).
            const locked = isLocked(loc)
            return (
              <tr key={loc.id ?? i}>
                <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LocationBadge name={loc.name} color={loc.color} icon={loc.icon} />
                    {loc.name}
                  </div>
                </td>
                <td style={TD}>{formatAddress(loc)}</td>
                <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                  {loc.created_at ? new Date(loc.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td style={{ ...TD, textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async,
                        never claims "done" (see GeocodeButton). No bulk for locations (BE spec). */}
                    <GeocodeButton endpoint={`/locations/${loc.id}/geocode`} permission="settings.update"
                      disabled={!loc.postal_code && !loc.city && !loc.street} variant="row" />
                    <button onClick={() => onEdit(loc)} title={t('locations.edit')} aria-label={t('locations.edit')}
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               background: 'var(--hover-bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>
                      <Pencil size={12} />
                    </button>
                    {/* Delete is live (LOC-DELETE-GUARD-1): disabled only when the backend
                        already flagged this location as in use; the 409 catch in the
                        container is the belt-and-suspenders path for a race with a fresher link. */}
                    <button onClick={() => onDelete(loc)} disabled={deletingId === loc.id || locked}
                      title={locked ? t('locations.deleteBlockedTooltip') : t('locations.delete')}
                      aria-label={locked ? t('locations.deleteBlockedTooltip') : t('locations.delete')}
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                               background: locked ? 'var(--hover-bg)' : 'var(--color-danger-bg)', border: 'none', borderRadius: 6,
                               cursor: (deletingId === loc.id || locked) ? 'not-allowed' : 'pointer',
                               color: locked ? 'var(--text-muted)' : 'var(--color-danger)', opacity: locked ? 0.5 : 1 }}>
                      {deletingId === loc.id ? <Spinner size={12} /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
            style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--border)' : 'var(--text)' }}>
            {t('locations.prev')}
          </button>
          <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--border)' : 'var(--text)' }}>
            {t('locations.next')}
          </button>
        </div>
      )}
    </div>
  )
}
