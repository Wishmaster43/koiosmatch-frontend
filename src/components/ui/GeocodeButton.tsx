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
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
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
  // GEO-INLINE-1 (CMBE 04-08): the per-id route answers INLINE now — fresh
  // coordinates (or an honest geocoded:false) instead of 202-queued. Hosts pass
  // this to receive the result and update their own display without a refetch.
  onResult?: (lat: number, lng: number) => void
}

export default function GeocodeButton({ endpoint, permission, disabled = false, variant = 'ghost', onResult }: GeocodeButtonProps) {
  const { t } = useTranslation('common')
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)
  const [loading, setLoading] = useState(false)

  // Hide entirely without the permission — never render a disabled affordance the
  // recruiter can't use anyway (mirrors the other hide-not-disable gates in this repo).
  if (!hasPermission(permission)) return null

  // GEO-INLINE-1: the per-id route runs inline now (CMBE 04-08, measured 64-214ms) and
  // returns the real outcome — coordinates, or an honest `geocoded: false` when the
  // address can't be resolved. Coordinates arrive as Laravel decimal STRINGS (§10),
  // so they go through toCoord, never a typeof check. A legacy 202/empty body still
  // falls back to the old "started" toast (bulk stays queued by design).
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

  // Ghost: transparent icon (drawer title-row). Row: boxed icon-button (settings table row).
  const ghostStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 4, display: 'flex', color: 'var(--text-muted)', opacity: disabled ? 0.4 : 0.8,
  }
  const rowStyle: CSSProperties = {
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--hover-bg)', border: 'none', borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: disabled ? 0.5 : 1,
  }

  return (
    <button type="button" onClick={handleClick} disabled={disabled || loading}
      title={t('geocode.refresh')} aria-label={t('geocode.refresh')}
      style={variant === 'row' ? rowStyle : ghostStyle}>
      <RefreshCw size={variant === 'row' ? 12 : 14} className={loading ? 'animate-spin' : ''} />
    </button>
  )
}
