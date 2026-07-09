/**
 * usePriceAgreements — a customer's price agreements (MATCH-PLC price-agreements,
 * delivered 2026-07-09): GET/POST /customers/{id}/price-agreements + PATCH/DELETE
 * …/price-agreements/{paId}. Each of function_title/cao/scale/step is optional —
 * null means "any" (wildcard) and the most specific match wins on the backend's
 * rate-proposal lookup. purchase_rate + valid_from are required. Optimistic
 * add/update/remove, reconciled with the server row; reverts + toasts on failure
 * (mirrors useEntityDocuments — one shared shape for entity sub-resource CRUD).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'

export interface PriceAgreement {
  id: Id
  functionTitle: string | null
  cao: string | null
  scale: string | null
  step: string | null
  purchaseRate: number | null
  saleRate: number | null
  validFrom: string | null
  validUntil: string | null
  remarks: string | null
}

// The editable payload (create + update use the same shape).
export type PriceAgreementPayload = Omit<PriceAgreement, 'id'>

// Raw API row, read defensively (field names per the BE contract).
interface ApiPriceAgreement {
  id?: Id
  function_title?: string | null
  cao?: string | null
  scale?: string | null
  step?: string | null
  purchase_rate?: number | string | null
  sale_rate?: number | string | null
  valid_from?: string | null
  valid_until?: string | null
  remarks?: string | null
}

// A persisted agreement has a real (UUID) id; an optimistic row carries a `tmp-…` id.
const isTemp = (id: Id) => typeof id === 'string' && id.startsWith('tmp-')
const toNum = (v: unknown): number | null => (v === null || v === undefined || v === '') ? null : Number(v)

// Normalise an API row to the flat UI shape.
const toUi = (r: ApiPriceAgreement): PriceAgreement => ({
  id: r.id ?? '',
  functionTitle: r.function_title ?? null,
  cao: r.cao ?? null,
  scale: r.scale ?? null,
  step: r.step ?? null,
  purchaseRate: toNum(r.purchase_rate),
  saleRate: toNum(r.sale_rate),
  validFrom: r.valid_from ?? null,
  validUntil: r.valid_until ?? null,
  remarks: r.remarks ?? null,
})

// Build the API body — empty strings become null (wildcard), never sent as "".
const toApi = (p: PriceAgreementPayload) => ({
  function_title: p.functionTitle || null,
  cao: p.cao || null,
  scale: p.scale || null,
  step: p.step || null,
  purchase_rate: p.purchaseRate,
  sale_rate: p.saleRate,
  valid_from: p.validFrom || null,
  valid_until: p.validUntil || null,
  remarks: p.remarks || null,
})

export function usePriceAgreements(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [agreements, setAgreements] = useState<PriceAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Load the list whenever the customer changes.
  const load = useCallback(() => {
    if (!customerId) { setAgreements([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/price-agreements`)
      .then(res => setAgreements(unwrapList<ApiPriceAgreement>(res).rows.map(toUi)))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [customerId])
  useEffect(() => { load() }, [load])

  // Create — optimistic row with a temp id, swapped for the server row on success.
  const add = useCallback((payload: PriceAgreementPayload) => {
    if (!customerId) return
    const tmpId = `tmp-${Date.now()}`
    setAgreements(a => [{ ...payload, id: tmpId }, ...a])
    api.post(`/customers/${customerId}/price-agreements`, toApi(payload))
      .then(res => { const saved = toUi(unwrap<ApiPriceAgreement>(res)); setAgreements(a => a.map(x => x.id === tmpId ? saved : x)) })
      .catch(() => { setAgreements(a => a.filter(x => x.id !== tmpId)); notifyError(t('priceAgreements.saveFailed')) })
  }, [customerId, t])

  // Update — optimistic patch, reverts the whole list on failure.
  const update = useCallback((id: Id, payload: PriceAgreementPayload) => {
    if (!customerId) return
    const snapshot = agreements
    setAgreements(a => a.map(x => x.id === id ? { ...payload, id } : x))
    api.patch(`/customers/${customerId}/price-agreements/${id}`, toApi(payload))
      .then(res => { const saved = toUi(unwrap<ApiPriceAgreement>(res)); setAgreements(a => a.map(x => x.id === id ? saved : x)) })
      .catch(() => { setAgreements(snapshot); notifyError(t('priceAgreements.saveFailed')) })
  }, [customerId, agreements, t])

  // Delete — optimistic remove; a 409 (still referenced) gets its own message.
  const remove = useCallback((id: Id) => {
    if (!customerId) return
    const snapshot = agreements
    setAgreements(a => a.filter(x => x.id !== id))
    if (isTemp(id)) return
    api.delete(`/customers/${customerId}/price-agreements/${id}`)
      .catch(e => {
        setAgreements(snapshot)
        notifyError(e?.response?.status === 409 ? t('priceAgreements.deleteInUse') : t('priceAgreements.deleteFailed'))
      })
  }, [customerId, agreements, t])

  return { agreements, loading, error, reload: load, add, update, remove }
}
