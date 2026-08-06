/**
 * useVacancyPrefill — fetches the full vacancy detail (GET /vacancies/{id}) once a
 * vacancy is picked in the match form, and normalises it down to the REAL fields
 * worth proposing onto the match (point 1, Danny's ten-point round: the vacancy pick
 * prefills klant/klantlocatie/afdeling/contactpersoon/vestiging/dates/uren as
 * EDITABLE proposals, never a lock). Bypasses the shared `mapVacancyDetail` mapper —
 * mirrors this hook family's own precedent (useBranchMismatch / useMatchForm's own
 * `editDetail` fetch): a small local interface over the raw response, read directly,
 * not the full drawer mapper (out of scope here, §0.1 stay-in-scope).
 *
 * VERIFIED against the backend contract (koiosmatch-api, 2026-08-06 —
 * VacancyDetailResource.php / VacancyListResource.php / the vacancies migration):
 *  - customer_id (nested `customer.id`), customer_location_id, customer_department_id,
 *    contact_id: real columns, always serialised (VAC-CASCADE-1/VAC-NEST-1).
 *  - location_id (the bureau's own "vestiging"/branch): a real column
 *    (VAC-NEST-1 point 8) — despite `Vacancy::branchParentRelation()` naming
 *    `client` for AUTHORISATION purposes, the vacancy carries its OWN location_id.
 *  - start_date/end_date: the vacancy's own runtime window (VAC-DATES-1) — real.
 *  - hours: the vacancy only stores a RANGE (`hours_min`/`hours_max`, i.e.
 *    working_hours_from/to) — never a single "hours per week". Only prefilled
 *    when that range collapses to one number (min === max); a genuine range is
 *    left blank rather than guessed (§3, no fake affordances).
 *  - contract type / CAO: DELIBERATELY not read here. The vacancy's own
 *    `contract_types` is a DIFFERENT tenant lookup (Contractvorm/candidate-type,
 *    multi) from the match's `contract_type` (the Fase/ZZP lookup behind
 *    /contract-types, single) — the vocabularies don't line up, so prefilling one
 *    from the other would silently write the wrong slug. CAO has no column on
 *    `vacancies` at all. Both are real backend gaps if Danny wants them wired —
 *    flagged as CMBE follow-ups in the delivering PR notes, not silently guessed.
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyPrefillDetail {
  customerId: string
  customerLocationId: string
  customerDepartmentId: string
  contactId: string
  branchId: string
  startDate: string
  endDate: string
  // '' when the vacancy carries no single, unambiguous hours value (a real range).
  hours: string
}

const EMPTY_DETAIL: VacancyPrefillDetail = {
  customerId: '', customerLocationId: '', customerDepartmentId: '', contactId: '',
  branchId: '', startDate: '', endDate: '', hours: '',
}

// The raw GET /vacancies/{id} shape this hook reads — only the fields it uses.
interface RawVacancyDetail {
  customer?: { id?: Id } | null
  customer_location_id?: Id | null
  customer_department_id?: Id | null
  contact_id?: Id | null
  location_id?: Id | null
  start_date?: string | null
  end_date?: string | null
  hours_min?: number | string | null
  hours_max?: number | string | null
}

export function useVacancyPrefill(vacancyId: string): VacancyPrefillDetail | null {
  const [detail, setDetail] = useState<VacancyPrefillDetail | null>(null)

  // Re-fetch whenever the picked vacancy changes; null (nothing to propose) once cleared.
  useEffect(() => {
    if (!vacancyId) { setDetail(null); return }
    let alive = true
    api.get(`/vacancies/${vacancyId}`)
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) as RawVacancyDetail
        const hMin = d?.hours_min != null ? Number(d.hours_min) : null
        const hMax = d?.hours_max != null ? Number(d.hours_max) : null
        setDetail({
          customerId: d?.customer?.id != null ? String(d.customer.id) : '',
          customerLocationId: d?.customer_location_id != null ? String(d.customer_location_id) : '',
          customerDepartmentId: d?.customer_department_id != null ? String(d.customer_department_id) : '',
          contactId: d?.contact_id != null ? String(d.contact_id) : '',
          branchId: d?.location_id != null ? String(d.location_id) : '',
          startDate: d?.start_date ?? '',
          endDate: d?.end_date ?? '',
          // Only unambiguous (a fixed number, not a real min≠max range) — never guessed.
          hours: (hMin != null && hMax != null && hMin === hMax) ? String(hMin) : '',
        })
      })
      .catch(() => { if (alive) setDetail(EMPTY_DETAIL) })
    return () => { alive = false }
  }, [vacancyId])

  return detail
}
