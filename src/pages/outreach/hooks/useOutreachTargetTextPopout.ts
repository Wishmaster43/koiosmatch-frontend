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

  const load = useCallback(() => {
    if (!campaignId || !targetId) { setLoading(false); return }
    setLoading(true); setError(false)
    getCampaign(campaignId)
      .then(raw => {
        const campaign = raw as CampaignDetail
        const row = (campaign.targets ?? []).find(t => String(t.id) === targetId)
        if (!row) { setError(true); return }
        const name = row.candidate?.name
          ?? ([row.candidate?.first_name, row.candidate?.last_name].filter(Boolean).join(' ') || '?')
        setTarget({ id: targetId, campaignId, candidateName: name, note: row.note ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [campaignId, targetId])

  useEffect(() => { load() }, [load])
  return { target, loading, error, reload: load }
}

// Standalone PATCH /outreach-targets/{id} — the SAME route/body TargetsTab's
// own onSetNote uses.
export function patchTargetNote(targetId: string, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return updateTarget(targetId, { note: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
