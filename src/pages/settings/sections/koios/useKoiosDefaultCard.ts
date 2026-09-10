/**
 * useKoiosDefaultCard — the shared head of KoiosEffortDefaultCard and
 * KoiosModeDefaultCard: the settings.update edit gate, the live settings blob,
 * and the saving/error state each card's own save() flow drives. The i18n
 * namespace stays each card's own useTranslation call (rule C: the shared unit
 * never decides the namespace), called before this hook so the hook order is
 * exactly the inline order it replaced. Wrapping useState calls in a custom hook does not change
 * React's hook call order (hooks are tracked by call sequence, not by
 * nesting), so both consumers keep identical render behaviour
 * (DRY round 11, SETTINGS2).
 */
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings } from '@/lib/settings/useAllSettings'

export function useKoiosDefaultCard() {
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const values = useAllSettings()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return { canEdit, values, saving, setSaving, error, setError }
}
