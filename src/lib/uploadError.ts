import type { TFunction } from 'i18next'
import { extractApiError } from '@/lib/extractApiError'

// True when the server (or the proxy in front of it) refused the body as too large.
export function isPayloadTooLarge(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 413
}

// True when the storage disk did not confirm the write or delete (ONIX F-013/F-011, BE b2cb6be5):
// a 503 whose body carries code "storage_unavailable" — nothing was created or removed.
export function isStorageUnavailable(err: unknown): boolean {
  const r = (err as { response?: { status?: number; data?: { code?: string } } })?.response
  return r?.status === 503 && r?.data?.code === 'storage_unavailable'
}

// Upload failure text: an HTTP 413 gets the honest "too large" sentence (the proxy answers
// before Laravel runs, so there is no message), a storage 503 the "try again" sentence;
// anything else keeps the extractApiError path.
export function uploadErrorMessage(err: unknown, t: TFunction, fallback: string): string {
  if (isPayloadTooLarge(err)) return t('common:upload.tooLarge')
  if (isStorageUnavailable(err)) return t('common:upload.storageUnavailable')
  return extractApiError(err, fallback)
}
