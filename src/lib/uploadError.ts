import type { TFunction } from 'i18next'
import { extractApiError } from '@/lib/extractApiError'

// True when the server (or the proxy in front of it) refused the body as too large.
export function isPayloadTooLarge(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 413
}

// Upload failure text: an HTTP 413 gets the honest "too large" sentence (the proxy answers
// before Laravel runs, so there is no message); anything else keeps the extractApiError path.
export function uploadErrorMessage(err: unknown, t: TFunction, fallback: string): string {
  return isPayloadTooLarge(err) ? t('common:upload.tooLarge') : extractApiError(err, fallback)
}
