/**
 * useVacancyTextPopout — V-desc-1: the second-screen plumbing for the vacancy
 * description, mirroring useCustomerTextPopout (customers/hooks/
 * useCustomerTextPopout.ts) 1:1 — a light identity fetch for the popped-out
 * window (a separate render tree with no access to the drawer's own list/detail
 * state) plus a standalone PATCH /vacancies/{id}, the same route/field the
 * drawer's own DescriptionTab writes through useVacancyRecord.updateVacancy.
 */
import { useCallback, useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

export interface VacancyTextLite { id: string; title: string; initials: string; description: string }

// The subset of the raw vacancy resource this popout actually reads.
interface RawVacancyLite { id?: Id; title?: string; description?: string | null }

// Light identity fetch for the popped-out vacancy description window.
export function useVacancyTextLite(id: string | undefined) {
  const [vacancy, setVacancy] = useState<VacancyTextLite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!id) { setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/vacancies/${id}`)
      .then(r => {
        const raw = unwrap<RawVacancyLite>(r)
        const title = raw.title ?? '?'
        setVacancy({ id: String(raw.id ?? id), title, initials: initialsOf(title), description: raw.description ?? '' })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])
  return { vacancy, loading, error, reload: load }
}

// Standalone PATCH /vacancies/{id} — same field the drawer's own DescriptionTab
// writes (`description`, via useVacancyRecord.updateVacancy).
export function patchVacancyText(id: Id, html: string, t: TFunction, revert: () => void): Promise<boolean> {
  return api.patch(`/vacancies/${id}`, { description: html })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
