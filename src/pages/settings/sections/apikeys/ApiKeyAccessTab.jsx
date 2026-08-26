/**
 * ApiKeyAccessTab — the "Access" tab. Edits are local (draft) until "Save", which
 * persists the whole scope map. The row rendering lives in the shared ScopeEditor
 * so create + edit stay identical.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import ScopeEditor from './ScopeEditor'
import Spinner from '@/components/ui/Spinner'
import SaveButton from '@/components/ui/SaveButton'

// The Access tab: edits the scope map as a local draft, persisted only on Save.
export default function ApiKeyAccessTab({ scopes, onSave }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft]   = useState(() => ({ ...(scopes ?? {}) }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  // Dirty when the draft scope map differs from the persisted one.
  const dirty = JSON.stringify(draft) !== JSON.stringify(scopes ?? {})

  // Persist the whole draft scope map, briefly showing a saved confirmation.
  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch { /* surfaced by the detail container */ }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Save bar */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('apiKeys.access.subtitle')}</p>
        <SaveButton onClick={save} disabled={!dirty || saving} saved={saved}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><Spinner size={13} /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </SaveButton>
      </div>

      <ScopeEditor value={draft} onChange={setDraft} />
    </div>
  )
}
