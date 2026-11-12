/**
 * ExternalIdCell - the ONE inline editor for an external-system id (HelloFlex GUID,
 * Shiftmanager id) in a table cell. Read-only face: plain text (or a dash) with a
 * copy button; edit face: input + SaveButton, Enter saves, Escape reverts. A blank
 * value clears the link (null); a failed save keeps the draft so the user can retry
 * (the caller surfaces the error toast). Dumb: no API calls, the caller persists.
 */
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import SaveButton from './SaveButton'
import Spinner from './Spinner'
import CopyIconButton from './CopyIconButton'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

export interface ExternalIdCellProps {
  // The stored external id, or null when the record is not linked.
  value: string | null
  // Persists the next value (null = unlink); rejects on failure.
  onSave: (next: string | null) => Promise<void>
  // False renders the read-only face (no fake affordance).
  canEdit: boolean
  // Accessible name of the input (names the system).
  label: string
  placeholder?: string
  // Translated name of what the read-only copy button copies (e.g. column + record name).
  copyLabel?: string
  maxLength?: number
  // Translated link status (caller-owned copy), shown as hover title.
  statusLabel?: string | null
  // True when the link failed: the server error is appended to the hover title.
  failed?: boolean
  error?: string | null
  // True while the first read is pending: a spinner replaces the value.
  loading?: boolean
}

// Hover text: the status, followed by the server error when the link failed.
function hoverTitle(statusLabel?: string | null, failed?: boolean, error?: string | null): string | undefined {
  const parts = [statusLabel, failed ? error : null].filter(Boolean)
  return parts.length ? parts.join(': ') : undefined
}

export default function ExternalIdCell({ value, onSave, canEdit, label, placeholder, copyLabel, maxLength = 255, statusLabel, failed, error, loading }: ExternalIdCellProps) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const title = hoverTitle(statusLabel, failed, error)

  // Loading face: a muted spinner, never a value that could be mistaken for "unlinked".
  if (loading) return <span aria-busy="true"><Spinner size={14} /></span>

  // Read-only face: text plus copy button, status as hover title.
  if (!canEdit) {
    return (
      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {value ?? '—'}
        <CopyIconButton value={value} label={copyLabel ?? t('referenceNumber.copy')} copiedLabel={t('referenceNumber.copied')} />
      </span>
    )
  }

  const current = draft ?? value ?? ''
  const dirty = current.trim() !== (value ?? '')

  // Save the trimmed draft ('' unlinks); the draft clears on success and stays on failure.
  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const next = current.trim()
      await onSave(next === '' ? null : next)
      setDraft(null)
    } catch {
      // The caller toasts the error; the draft stays so the user can retry.
    } finally {
      setSaving(false)
    }
  }

  // Enter saves, Escape reverts the draft.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void save() }
    else if (e.key === 'Escape') setDraft(null)
  }

  return (
    <div title={title} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input maxLength={maxLength} aria-label={label} placeholder={placeholder} value={current} style={fieldInputStyle}
        onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
      <SaveButton iconOnly aria-label={`${t('save')} ${label}`} size="sm" saved={!dirty && value != null} disabled={!dirty || saving} onClick={() => void save()}>
        {saving ? <Spinner size={14} /> : <Check size={14} />}
      </SaveButton>
    </div>
  )
}
