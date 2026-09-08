/**
 * useVacancyTextPopout — V-desc-1: the second-screen plumbing for the vacancy
 * description, mirroring useCustomerTextPopout (customers/hooks/
 * useCustomerTextPopout.ts) 1:1 — a light identity fetch for the popped-out
 * window (a separate render tree with no access to the drawer's own list/detail
 * state) plus a standalone PATCH /vacancies/{id}, the same route/field the
 * drawer's own DescriptionTab writes through useVacancyRecord.updateVacancy.
 */
import { useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useLiteRecord } from '@/hooks/useLiteRecord'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface VacancyTextLite { id: string; title: string; initials: string; description: string }

// The subset of the raw vacancy resource this popout actually reads.
interface RawVacancyLite { id?: Id; title?: string; description?: string | null }

// Mapper: fetch and build the VacancyTextLite from the raw response.
function mapVacancyTextLite(raw: RawVacancyLite, id: string): VacancyTextLite {
  const title = raw.title ?? '?'
  return {
    id: String(raw.id ?? id),
    title,
    initials: initialsOf(title),
    description: raw.description ?? ''
  }
}

// Light identity fetch for the popped-out vacancy description window.
export function useVacancyTextLite(id: string | undefined) {
  // Fetch and map in one stable callback so useLiteRecord's effect stays single-run per id.
  const fetchRecord = useCallback(
    (vacancyId: string) => api.get(`/vacancies/${vacancyId}`).then(r => {
      const raw = unwrap<RawVacancyLite>(r)
      return mapVacancyTextLite(raw, vacancyId)
    }),
    []
  )
  const { record: vacancy, loading, error, reload } = useLiteRecord(id, fetchRecord)
  return { vacancy, loading, error, reload }
}

// Standalone PATCH /vacancies/{id} — same field the drawer's own DescriptionTab
// writes (`description`, via useVacancyRecord.updateVacancy).
export function patchVacancyText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/vacancies/${id}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
