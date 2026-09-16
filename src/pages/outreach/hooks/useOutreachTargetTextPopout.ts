/**
 * useOutreachTargetTextPopout — BELLIJST-NOTE-POPOUT-1: the second-screen
 * plumbing for one call-list target's note. Mirrors
 * customers/hooks/useCustomerTextPopout's department case 1:1: there is no
 * standalone `GET /outreach-targets/{id}` (measured —
 * routes/api/tenant/tasks-outreach.php only wires
 * `PATCH outreach-targets/{target}`), so this window loads the CAMPAIGN detail
 * (`GET /outreach-campaigns/{id}`, which already eager-loads `targets.candidate`
 * — OutreachCampaignController::show) and picks the one target row, exactly
 * like the department popout picks its row out of the customer's department
 * list. Saving goes through the SAME `PATCH /outreach-targets/{id}` route
 * TargetsTab's own `onSetNote` uses (useOutreachDetail.setTargetNote), called
 * directly here since the popup window has no drawer state to route an
 * optimistic patch through.
 */
import { useCallback, useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import { getCampaign, updateTarget } from '../data/outreachApi'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { CampaignDetail } from './useOutreachDetail'

export interface OutreachTargetTextLite {
  id: string
  campaignId: string
  candidateName: string
  note: string
}

// Light identity fetch for the popped-out target-note window — reads the
// campaign detail and finds the one target row (no single-target GET, see the
// file header).
export function useOutreachTargetTextLite(campaignId: string | undefined, targetId: string | undefined) {
  const [target, setTarget] = useState<OutreachTargetTextLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch the campaign detail and pick out this one target row (see file doc for why).
  // §9: `alive` is a RUN-LOCAL flag (mirrors useOutreachDetail.ts's own `let alive`),
  // not a shared ref — on a campaignId/targetId switch the effect's cleanup below
  // fires before its new setup, so a shared ref would already read `false` when the
  // PREVIOUS run's still-in-flight promise resolves, letting a stale response through
  // undetected. Each call captures its own flag and only that run's cleanup flips it.
  const load = useCallback(() => {
    if (!campaignId || !targetId) { setLoading(false); return () => {} }
    let alive = true
    setLoading(true); setError(false)
    getCampaign(campaignId)
      .then(raw => {
        if (!alive) return
        const campaign = raw as CampaignDetail
        const row = (campaign.targets ?? []).find(t => String(t.id) === targetId)
        if (!row) { setError(true); return }
        const name = row.candidate?.name
          ?? ([row.candidate?.first_name, row.candidate?.last_name].filter(Boolean).join(' ') || '?')
        setTarget({ id: targetId, campaignId, candidateName: name, note: row.note ?? '' })
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [campaignId, targetId])

  // Load once on mount and on every campaign/target id change; the returned
  // cleanup cancels only THIS run's flag, never a shared one (see `load` doc).
  useEffect(() => {
    const cancel = load()
    return cancel
  }, [load])

  // Manual retry (e.g. an ErrorBanner) — fire-and-forget; its own run manages its own flag.
  const reload = useCallback(() => { load() }, [load])
  return { target, loading, error, reload }
}

// Standalone PATCH /outreach-targets/{id} — the SAME route/body TargetsTab's
// own onSetNote uses.
export function patchTargetNote(targetId: string, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return updateTarget(targetId, { note: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
