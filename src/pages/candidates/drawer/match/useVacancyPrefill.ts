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
 *  - contract_type / cao (VACANCY-CONTRACT-FIELD-1, migration
 *    2026_06_15_000030_create_vacancy_table): a SEPARATE pair of singular columns
 *    from the vacancy's own MULTI-value `contract_types` (Contractvorm) above —
 *    these two mirror the match's own `contract_type`/`cao` fields byte-for-byte,
 *    same lookup tables (`contract_types.value` / `collective_labour_agreements.
 *    value`, confirmed via the shared `App\Support\MatchRules::LOOKUPS`, which
 *    both StoreVacancyRequest AND Store/UpdateMatchRequest validate through —
 *    the vocabulary-mismatch gap this docblock used to flag is closed). RE-
 *    VERIFIED LIVE 2026-08-06 (tenant `yesway`, GET+PATCH /vacancies/{id}
 *    against the running dev API): both keys are always present in the response
 *    (null on an unconfigured row) and a PATCH round-trips a real value — so
 *    both are read and proposed here now, no guessing involved.
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
  // VACANCY-CONTRACT-FIELD-1: the vacancy's own singular contract-kind/CAO slugs
  // (see the docblock above) — '' when the vacancy never set them.
  contractType: string
  cao: string
}

const EMPTY_DETAIL: VacancyPrefillDetail = {
  customerId: '', customerLocationId: '', customerDepartmentId: '', contactId: '',
  branchId: '', startDate: '', endDate: '', hours: '', contractType: '', cao: '',
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
  // VACANCY-CONTRACT-FIELD-1: plain slug strings, same shape as the match's own.
  contract_type?: string | null
  cao?: string | null
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
          // VACANCY-CONTRACT-FIELD-1: same vocabulary as the match's own fields — read straight through.
          contractType: d?.contract_type ?? '',
          cao: d?.cao ?? '',
        })
      })
      .catch(() => { if (alive) setDetail(EMPTY_DETAIL) })
    return () => { alive = false }
  }, [vacancyId])

  return detail
}
