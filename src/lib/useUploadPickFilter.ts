import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError } from '@/lib/notify'
import { useUploadPolicy, uploadRefusalText, type UploadSurface } from '@/lib/uploadPolicy'

// Picker helper for one upload surface: the `accept` string plus a filter that drops refused files
// and reports the refusals ONCE per pick (same wording as the server's file_type_not_allowed).
export function useUploadPickFilter(surface: UploadSurface): { accept: string; filterPicked: (files: File[]) => File[] } {
  const { i18n, t } = useTranslation()
  const { accept, check } = useUploadPolicy(surface)
  const filterPicked = useCallback((files: File[]) => {
    const refusals = new Set<string>()
    const kept = files.filter((f) => {
      const text = uploadRefusalText(check(f), t, i18n.language)
      if (text) refusals.add(text)
      return !text
    })
    if (refusals.size) notifyError([...refusals].join(' '))
    return kept
  }, [check, t, i18n.language])
  return { accept, filterPicked }
}
