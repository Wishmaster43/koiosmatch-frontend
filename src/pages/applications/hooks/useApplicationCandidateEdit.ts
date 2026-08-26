/**
 * useApplicationCandidateEdit — the application-drawer header's candidate
 * name/function edit state (Danny 2026-07-25: "wijzig de naam en functie van
 * de kandidaat" from the application drill-down, mirroring the candidate
 * drawer's own header pencil). The ApplicationDetail only carries the
 * candidate's JOINED display name and function — never the separate first/
 * middle/last parts — so startEdit fetches the raw candidate record ONCE to
 * load them; splitting the joined name here would silently destroy a Dutch
 * tussenvoegsel ("Isa van der Groen"). Mirrors useCandidateHeaderEdit's shape,
 * but is self-contained (owns its own GET/PATCH) since the application drawer
 * has no already-loaded full candidate record to read parts from.
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { invalidateCandidate } from '@/lib/invalidateEntity'
import type { Id } from '@/types/common'

/** The header-edit form's controlled fields — kept as separate name parts so
 * a tussenvoegsel round-trips intact (never split/joined client-side). */
export interface ApplicationCandidateForm {
  firstName: string
  middleName: string
  lastName: string
  functionTitle: string
}

/** Raw GET/PATCH /candidates/{id} shape read directly — mapCandidate() does
 * not carry the separate name parts, only the already-joined display name.
 * `name` is the server-COMPOSED, infix-aware display name (CandidateListResource
 * `full_name`) — present on the PATCH response too, so saveEdit can prefer it
 * over a local join. */
interface RawCandidateNameParts {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  function_title?: string | null
  name?: string | null
}

const EMPTY_FORM: ApplicationCandidateForm = { firstName: '', middleName: '', lastName: '', functionTitle: '' }

// Self-contained name/function editor for the application header (see the module doc above): fetches the raw candidate record once on edit-start so a Dutch tussenvoegsel never gets split/joined client-side.
export function useApplicationCandidateEdit(
  candidateId: Id | null,
  onSaved?: (candidateId: Id, patch: { candidateName: string; candidateFunction: string }) => void,
) {
  const { t } = useTranslation('applications')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<ApplicationCandidateForm>(EMPTY_FORM)
  // Alive-request token: a fast cancel/switch bumps this so a stale GET response
  // can never overwrite a form the user has already left (§9 alive-guard idiom).
  const requestRef = useRef(0)

  const setField = (k: keyof ApplicationCandidateForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Enter edit mode and load the candidate's separate name parts ONCE — never
  // derived from the already-joined candidateName (would destroy a tussenvoegsel).
  const startEdit = () => {
    if (candidateId == null) return
    const requestId = ++requestRef.current
    setEditing(true)
    setLoading(true)
    api.get(`/candidates/${candidateId}`)
      .then(r => {
        if (requestRef.current !== requestId) return
        const raw = unwrap<RawCandidateNameParts>(r)
        setForm({
          firstName: raw.first_name ?? '',
          middleName: raw.middle_name ?? '',
          lastName: raw.last_name ?? '',
          functionTitle: raw.function_title ?? '',
        })
      })
      .catch(err => {
        if (requestRef.current !== requestId) return
        // No safe data to edit — leaving the form open risks overwriting the
        // real name with blanks on save (§3: no fake affordances).
        setEditing(false)
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
      .finally(() => { if (requestRef.current === requestId) setLoading(false) })
  }

  // Drop the form and leave edit mode — a plain cancel, no request.
  const cancelEdit = () => {
    requestRef.current++
    setEditing(false)
    setForm(EMPTY_FORM)
  }

  // Persist the parts (never the joined name) and report the freshly joined
  // display name + function back to the caller for its optimistic list merge.
  const saveEdit = () => {
    if (candidateId == null) return
    setSaving(true)
    const body = {
      first_name: form.firstName,
      middle_name: form.middleName,
      last_name: form.lastName,
      function_title: form.functionTitle,
    }
    return api.patch(`/candidates/${candidateId}`, body)
      .then(res => {
        // Prefer the server-composed, infix-aware name (CandidateListResource's
        // `full_name`) over a local join — the join here is a plain space-filter,
        // which can disagree with the server's own tussenvoegsel formatting. Fall
        // back to the local join only when the response carries no name at all.
        const serverName = unwrap<RawCandidateNameParts>(res).name
        const candidateName = serverName || [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
        onSaved?.(candidateId, { candidateName, candidateFunction: form.functionTitle })
        // REFRESH-FIX-2: reconcile the candidate + applications caches — the
        // optimistic onSaved merge above only updates THIS drawer's own view.
        invalidateCandidate(queryClient)
        setEditing(false)
      })
      .catch(err => {
        // Keep edit mode open — a failed save must never look like it succeeded.
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
      .finally(() => setSaving(false))
  }

  return { editing, startEdit, cancelEdit, saveEdit, loading, saving, form, setField }
}
