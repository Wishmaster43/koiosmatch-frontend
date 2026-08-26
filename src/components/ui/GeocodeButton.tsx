/**
 * GeocodeButton (GEO-REGEOCODE-1) — the ONE shared "PDOK opnieuw ophalen" trigger,
 * reused verbatim on the candidate/customer/vacancy drawer header and the Settings
 * → Vestigingen row (never re-implemented per entity, §3A). Every per-id geocode
 * route is queued + rate-limited (202 Accepted) — the coordinates land later via
 * the async worker, so this only ever claims "started", never "done" (§3 honesty:
 * no fake affordances, no fake completion either).
 *
 * Permission-gated: hidden entirely (not disabled) when the caller lacks the
 * write permission for that entity — the backend re-checks regardless (§7, UI
 * gating is UX only).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import Button from '@/components/ui/Button'
import { notifySuccess, notifyError } from '@/lib/notify'
import { toCoord } from '@/lib/coords'
import { useAuth } from '@/context/AuthContext'

export interface GeocodeButtonProps {
  // Per-id geocode route, e.g. `/candidates/{id}/geocode` — POST, no body, 202 queued.
  endpoint: string
  // Permission gate (e.g. 'candidates.update'); missing it hides the button entirely.
  permission: string
  // Caller-set: true when there's nothing meaningful to geocode (no address on the
  // record) — this component never guesses that itself, it only renders what the
  // caller decides (§3: the disabled/hidden decision stays honest and explicit).
  disabled?: boolean
  // 'ghost' (default) matches the drawer title-row icon-only convention
  // (ChangelogPopover, merge, archive); 'row' matches a settings table row's boxed
  // icon-button convention (LocationsSettings' Pencil/Trash2 actions).
  variant?: 'ghost' | 'row'
  // Receives coordinates when a route answers INLINE, so the host can update its
  // display without a refetch. Measured 08-08 (and confirmed by CMBE): every
  // per-id geocode route is async by design and answers 202 {status:queued}, so
  // this does NOT fire today — it is a tolerant path, not the normal one.
  onResult?: (lat: number, lng: number) => void
}

// Fires the queued per-id geocode POST and only ever claims 'started' (see the module doc above — every route answers 202, so completion is never rendered as done here).
export default function GeocodeButton({ endpoint, permission, disabled = false, variant = 'ghost', onResult }: GeocodeButtonProps) {
  const { t } = useTranslation('common')
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const [loading, setLoading] = useState(false)

  // Hide entirely without the permission — never render a disabled affordance the
  // recruiter can't use anyway (mirrors the other hide-not-disable gates in this repo).
  if (!hasPermission(permission)) return null

  // The per-id routes are QUEUED by design (measured 08-08 on candidates/vacancies:
  // 202 {status:queued}; the coordinates land ~1s later via the worker), so the
  // normal outcome here is the honest "started" toast — never a claim of "done"
  // (§3). The inline branches stay because a route MAY answer with the real result:
  // coordinates arrive as Laravel decimal STRINGS (§10), hence toCoord, never a
  // typeof check; an explicit `geocoded: false` means the address didn't resolve.
  const handleClick = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      const res = await api.post(endpoint)
      const body = unwrap<{ lat?: unknown; lng?: unknown; geocoded?: boolean }>(res) ?? {}
      const lat = toCoord(body.lat)
      const lng = toCoord(body.lng)
      if (lat != null && lng != null) {
        onResult?.(lat, lng)
        notifySuccess(t('geocode.updated'))
      } else if (body.geocoded === false) {
        notifyError(t('geocode.notFound'))
      } else {
        notifySuccess(t('geocode.started'))
      }
    } catch {
      // Failures are surfaced by api.ts's own error handling (§10) — only stop the spinner.
    } finally {
      setLoading(false)
    }
  }

  // House Button (Danny 20-08, pasted the hand-styled 26px row variant: "mooier
  // ook in huisstijl"): ghost = the drawer title-row icon convention, secondary =
  // the boxed settings-row convention — both at Button's own sm 28px footprint.
  // The spinning glyph stays the refresh icon itself (same glyph, loading state).
  return (
    <Button variant={variant === 'row' ? 'secondary' : 'ghost'} iconOnly
      onClick={handleClick} disabled={disabled || loading}
      title={t('geocode.refresh')} aria-label={t('geocode.refresh')}>
      <RefreshCw size={variant === 'row' ? 12 : 14} className={loading ? 'animate-spin' : ''} />
    </Button>
  )
}
