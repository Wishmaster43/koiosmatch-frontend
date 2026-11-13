// Row mappers turning /candidates and /vacancies rows into picker options (moved verbatim out of PageAddApplicationModal, SIZE-TRIGGER-1).
import type { PickOption, RawPickRow } from './types'

// ownerId/ownerName (APP-OWNER-1): both /candidates and /vacancies already carry
// an `owner` object (CandidateListResource / VacancyListResource) — captured here
// so the owner-derivation chain below can read it straight off the picked option,
// no extra fetch for either the candidate or the non-locked vacancy pick.
// SUBLINE-1 (register PDF-SOLLICITATIES pt.1, Danny 14-08): "vijf keer Blom"
// (i.e. "five Bloms in the list") is unpickable by name alone — fold function
// title + city into the label itself,
// since the shared SearchSelect row only renders a plain string (no sub-line
// slot). " · " is a value separator here, never sentence punctuation (§5).
export const mapCandidateRow = (c: RawPickRow): PickOption => {
  const name = c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')
  const detail = [c.function_title, c.city].filter(Boolean).join(' · ')
  return {
    value: c.id ?? '', label: detail ? `${name} · ${detail}` : name,
    ownerId: c.owner?.id, ownerName: c.owner?.name,
  }
}
export const mapVacancyRow = (v: RawPickRow): PickOption => ({
  value: v.id ?? '', label: v.title ?? v.titel ?? '', client: v.client_name ?? v.client,
  ownerId: v.owner?.id, ownerName: v.owner?.name,
})
