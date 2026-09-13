/**
 * useLiteTextPopout — shared machinery behind every entity's "second-screen text
 * popout" hook (matches/tasks/vacancies/customers, DRILLDOWN-VOLGORDE-CANON §3A):
 * a light identity fetch for the popped-out window (a separate render tree with
 * no access to the drawer's own state) plus a standalone PATCH on the same field
 * the drawer itself writes. Each entity hook supplies its own raw shape, mapper
 * and endpoint; the fetch/patch plumbing itself is identical everywhere.
 */
import { useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useLiteRecord } from '@/hooks/useLiteRecord'
import type { TFunction } from 'i18next'
import type { Id } from '@/types/common'

// Light identity fetch for a popped-out text window: GET the entity, map the raw
// response to its lite shape via the caller's own (stable, module-level) mapper.
export function useLiteTextRecord<TRaw, TLite>(
  id: string | undefined,
  endpoint: string,
  mapRaw: (raw: TRaw, id: string) => TLite,
) {
  // Fetch and map in one stable callback so useLiteRecord's effect stays single-run per id.
  const fetchRecord = useCallback(
    (recordId: string) => api.get(`${endpoint}/${recordId}`).then(r => mapRaw(unwrap<TRaw>(r), recordId)),
    [endpoint, mapRaw]
  )
  return useLiteRecord(id, fetchRecord)
}

// Standalone PATCH of one field on the same route/field the drawer's own tab writes.
// `nullOnEmpty` mirrors the per-entity drawer behaviour (some null an empty string,
// some forward it as-is) — never assumed, always passed explicitly by the caller.
export function patchLiteText(
  endpoint: string, id: Id, field: string, html: string,
  t: TFunction, revert: () => void, nullOnEmpty = false,
): Promise<boolean> {
  const value = nullOnEmpty ? (html || null) : html
  return api.patch(`${endpoint}/${id}`, { [field]: value })
    .then(() => true)
    .catch(err => { revert(); notifyError(extractApiError(err, t('common:actionFailed'))); return false })
}
