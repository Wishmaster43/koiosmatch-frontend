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
import { useDateFormat } from '@/lib/datetime'
import GeocodeButton from '@/components/ui/GeocodeButton'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import LocationBadge from './LocationBadge'
import CopyIconButton from '@/components/ui/CopyIconButton'

// NECESSITY: these are shared `<th>`/`<td>` cell styles (not standalone text), spread
// across every column of this table. Migrating them to the Caption/BodyText atoms
// would mean restructuring every cell to wrap its content in a nested element — a
// table-wide layout change unrelated to and riskier than this file's DATUM-1 date
// fix; left as pre-existing debt (mirrors the documented allowlist in
// typography.houseStyle.test.js for the same Caption/BodyText pattern elsewhere).
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax
const TH = { padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax
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

// Settings locations table: paginated rows with edit/delete actions, disabled while isLocked (a delete in flight).
export default function LocationsTable({ isLocked, rows, page, totalPages, onPageChange, onEdit, onDelete, deletingId }) {
  const { t } = useTranslation(['settings', 'common'])
  // DATUM-1: DD-MM-YYYY HH:mm in every app language, never a hardcoded locale.
  const { formatDateTime } = useDateFormat()

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
                <td style={TD}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {formatAddress(loc)}
                    {/* ADRES-KOPIEER canon: every displayed address carries the shared copy button. */}
                    {formatAddress(loc) && <CopyIconButton value={formatAddress(loc)} label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} />}
                  </span>
                </td>
                <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                  {formatDateTime(loc.created_at)}
                </td>
                <td style={{ ...TD, textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async,
                        never claims "done" (see GeocodeButton). No bulk for locations (BE spec). */}
                    <GeocodeButton endpoint={`/locations/${loc.id}/geocode`} permission="settings.update"
                      disabled={!loc.postal_code && !loc.city && !loc.street} variant="row" />
                    <Button variant="secondary" iconOnly onClick={() => onEdit(loc)} title={t('locations.edit')} aria-label={t('locations.edit')}>
                      <Pencil size={12} />
                    </Button>
                    {/* Delete is live (LOC-DELETE-GUARD-1): disabled only when the backend
                        already flagged this location as in use; the 409 catch in the
                        container is the belt-and-suspenders path for a race with a fresher link.
                        dangerSoft + Button's own disabled recipe reproduce the exact
                        danger-tint→grey-out transition the hand-painted version had. */}
                    <Button variant="dangerSoft" iconOnly onClick={() => onDelete(loc)} disabled={deletingId === loc.id || locked}
                      title={locked ? t('locations.deleteBlockedTooltip') : t('locations.delete')}
                      aria-label={locked ? t('locations.deleteBlockedTooltip') : t('locations.delete')}>
                      {deletingId === loc.id ? <Spinner size={12} /> : <Trash2 size={12} />}
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        // The shared PaginationBar needs totalRows/pageSize/onPageSizeChange, which the
        // container (client-side slicing, fixed PER_PAGE) does not carry down today —
        // adding them means touching LocationsSettings.jsx, out of this file's scope. Falls
        // back to the house Button (secondary/sm) instead of a hand-painted pager pair.
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
            {t('locations.prev')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
            {t('locations.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
