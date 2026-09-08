/**
 * useCreateForm — shared state/handlers for two-phase create forms
 * (create → one-time secret reveal). Manages saving, error, and result states
 * across ApiKeyCreate, WebhookCreate, and similar two-phase workflows.
 */
import { useState } from 'react'

interface UseCreateFormResult<T> {
  saving: boolean
  error: boolean
  result: T | null
  setSaving: (v: boolean) => void
  setError: (v: boolean) => void
  setResult: (v: T | null) => void
}

/**
 * Shared form state for two-phase create forms: the form itself, plus the
 * three-state machine (idle, saving, error, success with result).
 */
export function useCreateForm<T>(): UseCreateFormResult<T> {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<T | null>(null)

  return { saving, error, result, setSaving, setError, setResult }
}
