import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Key, Plus, Trash2 } from 'lucide-react'
import api from '../../../lib/api'

export default function ApiKeysSettings() {
  const { t } = useTranslation('settings')
  const [keys,     setKeys]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newKey,   setNewKey]   = useState(null)

  useEffect(() => {
    api.get('/api-keys').then(r => setKeys(r.data?.data ?? r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/api-keys', { name: newName.trim() })
      setNewKey(res.data?.key ?? res.data?.token)
      setKeys(p => [...p, res.data])
      setNewName('')
    } catch { /* noop */ } finally { setCreating(false) }
  }

  const revoke = async (k) => {
    if (!confirm(t('apiKeys.revokeConfirm', { name: k.name }))) return
    try { await api.delete(`/api-keys/${k.id}`); setKeys(p => p.filter(x => x.id !== k.id)) } catch { /* noop */ }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('apiKeys.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('apiKeys.subtitle')}</p>
        </div>
      </div>

      {newKey && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>{t('apiKeys.newKeyBanner')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', background: 'white', border: '1px solid var(--color-success-bg)', borderRadius: 6, padding: '6px 10px', color: '#111827', overflow: 'auto' }}>{newKey}</code>
            <button onClick={() => navigator.clipboard.writeText(newKey)} style={{ height: 30, padding: '0 10px', fontSize: 12, border: '1px solid var(--color-success-bg)', borderRadius: 6, background: 'white', cursor: 'pointer' }}><Copy size={12} /></button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>{t('apiKeys.close')}</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('apiKeys.namePlaceholder')}
          onKeyDown={e => e.key === 'Enter' && create()}
          style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }} />
        <button onClick={create} disabled={creating || !newName.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: newName.trim() ? 1 : 0.4 }}>
          <Plus size={13} /> {t('apiKeys.create')}
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('apiKeys.empty')}</p>}
          {keys.map((k, i) => (
            <div key={k.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'white', border: '1px solid #F3F4F6', borderRadius: 10 }}>
              <Key size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{k.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {t('apiKeys.created')}: {k.created_at ? new Date(k.created_at).toLocaleDateString('nl-NL') : '—'}
                  {k.last_used_at && ` · ${t('apiKeys.used')}: ${new Date(k.last_used_at).toLocaleDateString('nl-NL')}`}
                </div>
              </div>
              <button onClick={() => revoke(k)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 12, border: '1px solid #FCA5A5', borderRadius: 7, background: '#FEF2F2', cursor: 'pointer', color: 'var(--color-danger)' }}>
                <Trash2 size={11} /> {t('apiKeys.revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
