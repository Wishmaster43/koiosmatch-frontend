import type { TFunction } from 'i18next'

// Merge endpoints (candidate/customer) only ever fail with a 403 (missing
// delete permission) or a generic failure — one translated notice per case,
// shared by every merge modal's catch block (never a raw server string).
export function reportMergeError(err: unknown, t: TFunction, notifyError: (msg: string) => void) {
  const status = (err as { response?: { status?: number } })?.response?.status
  notifyError(status === 403 ? t('merge.errForbidden') : t('merge.errFailed'))
}
