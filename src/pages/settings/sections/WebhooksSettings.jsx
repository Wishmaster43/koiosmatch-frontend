import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import api from '../../../lib/api'

export default function WebhooksSettings() {
  const { t } = useTranslation('settings')
  const [webhooks, setWebhooks] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState(null)

  const BASE_URL = 'http://koiosmatch-api.test/api/webhook'

  useEffect(() => {
    api.get('/webhooks')
      .then(res => setWebhooks(res.data?.data ?? res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/webhooks', { name: name.trim(), description: desc.trim() || null })
      setWebhooks(prev => [...prev, res.data?.data ?? res.data])
      setName('')
      setDesc('')
    } catch { /* noop */ }
    setCreating(false)
  }

  const remove = async (id) => {
    if (!confirm(t('webhooks.removeConfirm'))) return
    await api.delete(`/webhooks/${id}`).catch(() => {})
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  const copyUrl = (token) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t('webhooks.title')}</h2>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>{t('webhooks.subtitle')}</p>

      {/* New webhook */}
      <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>{t('webhooks.newWebhook')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder={t('webhooks.namePlaceholder')}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <input
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder={t('webhooks.descPlaceholder')}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
          />
        </div>
        <button onClick={create} disabled={!name.trim() || creating}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500,
                   background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
          <Plus size={13} />
          {creating ? t('webhooks.creating') : t('webhooks.create')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</div>
      ) : webhooks.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>{t('webhooks.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map(wh => (
            <div key={wh.id} style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{wh.name}</div>
                  {wh.description && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{wh.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {wh.last_triggered_at && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {t('webhooks.lastTriggered')}: {new Date(wh.last_triggered_at).toLocaleDateString('nl-NL')}
                    </span>
                  )}
                  <button onClick={() => remove(wh.id)}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                             background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-danger)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ flex: 1, fontSize: 11, background: '#F9FAFB', border: '1px solid #E5E7EB',
                               borderRadius: 6, padding: '6px 10px', color: '#374151', wordBreak: 'break-all' }}>
                  {BASE_URL}/{wh.token}
                </code>
                <button onClick={() => copyUrl(wh.token)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, fontWeight: 500,
                           background: copied === wh.token ? 'var(--color-success-bg)' : '#F3F4F6', color: copied === wh.token ? 'var(--color-success)' : '#374151',
                           border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === wh.token ? <Check size={11} /> : <Copy size={11} />}
                  {copied === wh.token ? t('common.copied') : t('webhooks.copyUrl')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
