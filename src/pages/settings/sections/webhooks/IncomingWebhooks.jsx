/**
 * IncomingWebhooks — the existing INBOUND webhooks: token URLs that external
 * systems POST to in order to trigger a workflow (used by WorkflowCanvasEditor).
 * Ported unchanged in behaviour from the old WebhooksSettings; only the i18n keys
 * moved under webhooks.incoming.* and the base URL now derives from VITE_API_URL.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import api from '../../../../lib/api'

// Inbound webhook URLs hang off the API root's /webhook path, not under /api.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
const BASE_URL = `${API_URL}/webhook`

export default function IncomingWebhooks() {
  const { t } = useTranslation('settings')
  const [webhooks, setWebhooks] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState(null)

  // Load the inbound webhooks for the active tenant.
  useEffect(() => {
    api.get('/webhooks')
      .then((res) => setWebhooks(res.data?.data ?? res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Create a new inbound webhook (name + optional description).
  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/webhooks', { name: name.trim(), description: desc.trim() || null })
      setWebhooks((prev) => [...prev, res.data?.data ?? res.data])
      setName('')
      setDesc('')
    } catch { /* noop */ }
    setCreating(false)
  }

  const remove = async (id) => {
    if (!confirm(t('webhooks.incoming.removeConfirm'))) return
    await api.delete(`/webhooks/${id}`).catch(() => {})
    setWebhooks((prev) => prev.filter((w) => w.id !== id))
  }

  const copyUrl = (token) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('webhooks.incoming.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{t('webhooks.incoming.subtitle')}</p>

      {/* New webhook */}
      <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('webhooks.incoming.newWebhook')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('webhooks.incoming.namePlaceholder')}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('webhooks.incoming.descPlaceholder')}
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
        </div>
        <button onClick={create} disabled={!name.trim() || creating}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
          <Plus size={13} /> {creating ? t('webhooks.incoming.creating') : t('webhooks.incoming.create')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</div>
      ) : webhooks.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('webhooks.incoming.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map((wh) => (
            <div key={wh.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{wh.name}</div>
                  {wh.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wh.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {wh.last_triggered_at && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {t('webhooks.incoming.lastTriggered')}: {new Date(wh.last_triggered_at).toLocaleDateString('nl-NL')}
                    </span>
                  )}
                  <button onClick={() => remove(wh.id)} aria-label={t('webhooks.incoming.removeConfirm')}
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-danger)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ flex: 1, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', wordBreak: 'break-all' }}>
                  {BASE_URL}/{wh.token}
                </code>
                <button onClick={() => copyUrl(wh.token)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, fontWeight: 500, background: copied === wh.token ? 'var(--color-success-bg)' : 'var(--hover-bg)', color: copied === wh.token ? 'var(--color-success)' : 'var(--text)', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copied === wh.token ? <Check size={11} /> : <Copy size={11} />} {copied === wh.token ? t('common.copied') : t('webhooks.incoming.copyUrl')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
