// liteRecordHeader — the shared candidateName/vacancyTitle/initials mapper for
// every entity whose second-screen notes popout header shows "whose notes these
// are" (applications, matches; DRY round 11, DRAWERS): both raw resources carry
// the same candidate/vacancy shape, so one mapper serves both.
import { initialsOf } from '@/lib/initials'

export interface LiteRecordHeader { id: string; candidateName: string; vacancyTitle: string; initials: string }

// The subset of the raw application/match resource this mapper reads.
interface RawLiteRecordHeader {
  id?: string | number
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidate_name?: string
  vacancy?: { title?: string }
  vacancy_title?: string
}

// Mapper for useEntityLite: extract candidate name + vacancy title.
export function liteRecordHeader(raw: unknown): LiteRecordHeader {
  const r = raw as RawLiteRecordHeader
  const candidateName = r.candidate?.name
    || [r.candidate?.first_name, r.candidate?.last_name].filter(Boolean).join(' ')
    || r.candidate_name || '?'
  const vacancyTitle = r.vacancy?.title || r.vacancy_title || ''
  return { id: String(r.id ?? ''), candidateName, vacancyTitle, initials: initialsOf(candidateName) }
}
