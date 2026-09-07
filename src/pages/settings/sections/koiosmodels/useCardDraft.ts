import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractApiError } from '@/lib/extractApiError'

/**
 * useCardDraft — shared state management for koiosmodels cards: draft state,
 * saving/saved/error flags, and the save callback pattern with transient
 * saved state (2s flash) and error display.
 */
export function useCardDraft<T, R = unknown>(
  initialData: T,
  onSave: (draft: T) => Promise<R>,
  isDirtyCheck: (draft: T, original: T) => boolean,
  onSuccess?: (result: R) => void,
) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState(initialData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = isDirtyCheck(draft, initialData)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await onSave(draft)
      onSuccess?.(result)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(extractApiError(err, t('koiosModelsAdmin.saveFailed')))
    }
    setSaving(false)
  }

  return { draft, setDraft, saving, saved, error, dirty, save }
}
