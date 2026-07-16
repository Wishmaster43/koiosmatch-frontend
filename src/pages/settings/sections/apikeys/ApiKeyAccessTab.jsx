/**
 * ApiKeyAccessTab — the "Access" tab. Edits are local (draft) until "Save", which
 * persists the whole scope map. The row rendering lives in the shared ScopeEditor
 * so create + edit stay identical.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import ScopeEditor from './ScopeEditor'
import { BTN_H } from '@/config/buttonMetrics'

export default function ApiKeyAccessTab({ scopes, onSave }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft]   = useState(() => ({ ...(scopes ?? {}) }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  // Dirty when the draft scope map differs from the persisted one.
  const dirty = JSON.stringify(draft) !== JSON.stringify(scopes ?? {})

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
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <button onClick={save} disabled={!dirty || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty || saved ? 1 : 0.55, background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      <ScopeEditor value={draft} onChange={setDraft} />
    </div>
  )
}
