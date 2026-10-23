/**
 * Single-line settings field that saves one key on blur (settings kit; used by the career-site and AI-interview screens).
 * Draft state is local; a failed save reverts the draft and surfaces the server error.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { SettingRow } from '@/pages/settings/components/SettingsKit'
import { Caption } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

interface BlurSaveFieldProps {
  settingKey: string
  stored: string
  label: string
  description: string
  placeholder: string
  type?: 'text' | 'tel' | 'url'
  /** Returns true when the trimmed draft may be saved (empty is always allowed). */
  isValid?: (value: string) => boolean
  invalidMessage?: string
}

// One labelled input that persists exactly its own settings key on blur.
export default function BlurSaveField({
  settingKey, stored, label, description, placeholder, type = 'text', isValid, invalidMessage,
}: BlurSaveFieldProps) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState(stored)
  const [invalid, setInvalid] = useState(false)

  // Validate, then save only a changed value; revert the draft when the server refuses.
  const handleBlur = () => {
    const trimmed = draft.trim()
    if (trimmed !== '' && isValid && !isValid(trimmed)) { setInvalid(true); return }
    setInvalid(false)
    if (trimmed === stored) return
    saveSettingsKeys({ [settingKey]: trimmed }).catch(err => {
      notifyError(extractApiError(err, t('common:actionFailed')))
      setDraft(stored)
    })
  }

  return (
    <SettingRow label={label} description={description}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <input
          type={type}
          aria-label={label}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{ ...fieldInputStyle, width: 280, borderColor: invalid ? 'var(--color-danger)' : 'var(--border)' }}
        />
        {invalid && invalidMessage && <span role="alert"><Caption as="span" style={{ color: 'var(--color-danger-text)' }}>{invalidMessage}</Caption></span>}
      </div>
    </SettingRow>
  )
}
