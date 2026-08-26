/**
 * addmodal/useLinkOptions — loads the three DEDICATED relational pickers of
 * AddTaskModal's Koppelingen ("Links") card (candidate · opdrachtgever,
 * "client" · contactpersoon, "contact person")
 * and reports their load state.
 *
 * Lifted out of the container (§3: logic lives in hooks) to fix a real §3 gap
 * found in the 09-08 house-rules pass: the three loads used to end in
 * `.catch(() => {})`, so a failed /candidates left the picker at zero options —
 * indistinguishable from "deze tenant heeft geen kandidaten" ("this tenant has
 * no candidates"). The recruiter now
 * gets the SAME honest error+retry line the sibling `links/AddLinkRow` already
 * had (that component is where the pattern comes from — §11, one behaviour).
 *
 * `Promise.allSettled`, not `Promise.all`: one dead endpoint must not blank the
 * two that answered. Every attempt carries an alive guard (§9) so a retry that
 * resolves after unmount never sets state, and the guard is re-armed in the
 * effect SETUP so StrictMode's double mount cannot leave it permanently false.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import api, { unwrapList } from '@/lib/api'
import { nameOf } from './formHelpers'
import type { EntityRow } from './formHelpers'

export interface LinkOption { value: string; label: string }

export interface LinkOptionsState {
  candidates: LinkOption[]
  customers: LinkOption[]
  contacts: LinkOption[]
  loading: boolean
  // True when ANY of the three endpoints failed — the card says so once.
  error: boolean
  retry: () => void
}

// The three lists in one state object, so a single set() lands them together.
interface Rows { candidates: EntityRow[]; customers: EntityRow[]; contacts: EntityRow[] }
const NO_ROWS: Rows = { candidates: [], customers: [], contacts: [] }

// Loads the three link pickers' options in parallel and exposes a combined loading/error/retry state.
export function useLinkOptions(): LinkOptionsState {
  const [rows, setRows] = useState<Rows>(NO_ROWS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Bumped by retry() — the effect's only dependency, so a retry re-runs it.
  const [attempt, setAttempt] = useState(0)

  // Fetch all three lists with allSettled so one dead endpoint doesn't blank the others that answered; alive-guarded against a stale response after unmount or a fast retry.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    // per_page 200 = the shared server cap — the server default (25) silently
    // truncated these pickers to the first 25 rows (fleet-verify 05-08).
    const load = (url: string) => api.get(url, { params: { per_page: 200 } }).then(r => unwrapList<EntityRow>(r).rows)
    Promise.allSettled([load('/candidates'), load('/customers'), load('/contacts')]).then(([c, cu, co]) => {
      if (!alive) return
      setRows({
        candidates: c.status === 'fulfilled' ? c.value : [],
        customers:  cu.status === 'fulfilled' ? cu.value : [],
        contacts:   co.status === 'fulfilled' ? co.value : [],
      })
      setError([c, cu, co].some(r => r.status === 'rejected'))
      setLoading(false)
    })
    return () => { alive = false }
  }, [attempt])

  const retry = useCallback(() => setAttempt(a => a + 1), [])

  // Map to picker options once per load, not on every render of the modal.
  const toOptions = (list: EntityRow[]): LinkOption[] => list.map(r => ({ value: String(r.id), label: nameOf(r) }))
  // Options for the candidate picker, recomputed only when its rows change.
  const candidates = useMemo(() => toOptions(rows.candidates), [rows.candidates])
  // Options for the customer picker, recomputed only when its rows change.
  const customers  = useMemo(() => toOptions(rows.customers),  [rows.customers])
  // Options for the contact picker, recomputed only when its rows change.
  const contacts   = useMemo(() => toOptions(rows.contacts),   [rows.contacts])

  return { candidates, customers, contacts, loading, error, retry }
}
