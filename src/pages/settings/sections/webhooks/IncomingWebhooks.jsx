/**
 * IncomingWebhooks — the existing INBOUND webhooks: token URLs that external
 * systems POST to in order to trigger a workflow (used by WorkflowCanvasEditor).
 * Ported unchanged in behaviour from the old WebhooksSettings; only the i18n keys
 * moved under webhooks.incoming.* and the base URL now derives from VITE_API_URL.
 * WEBHOOK-LOG-FE-1: each row also gets a "Verzoeken" (requests) button opening
 * the per-webhook request log (WebhookRequestsPanel) — the per-webhook drill-in
 * Danny asked for ("waar is mijn log wat er binnen zou moeten komen").
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Inbox, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useConfirm } from '@/hooks/useConfirm'
import Button from '@/components/ui/Button'
import { PageTitle, SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import WebhookRequestsPanel from './WebhookRequestsPanel'
// DATUM-1: every user-visible date rides the house formatter, never toLocaleDateString.
import { useDateFormat } from '@/lib/datetime'

// Inbound webhook URLs hang off the API root's /webhook path, not under /api.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
const BASE_URL = `${API_URL}/webhook`

export default function IncomingWebhooks() {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [webhooks, setWebhooks] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  // Which webhook's request log is open ({ id, name }) — the new drill-in.
  const [requestsFor, setRequestsFor] = useState(null)
  // House confirmation dialog (§0 restschuld) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Start / save an in-place edit of an existing webhook (name + description).
  const startEdit = (wh) => { setEditId(wh.id); setEditName(wh.name ?? ''); setEditDesc(wh.description ?? '') }
  const saveEdit = async (id) => {
    const nm = editName.trim(); if (!nm) return
    const description = editDesc.trim() || null
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, name: nm, description } : w)))
    setEditId(null)
    await api.patch(`/webhooks/${id}`, { name: nm, description }).catch(() => {})
  }

  // Load the inbound webhooks for the active tenant.
  useEffect(() => {
    api.get('/webhooks')
      .then((res) => setWebhooks(unwrapList(res).rows))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Create a new inbound webhook (name + optional description).
  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/webhooks', { name: name.trim(), description: desc.trim() || null })
      setWebhooks((prev) => [...prev, unwrap(res)])
      setName('')
      setDesc('')
    } catch { /* noop */ }
    setCreating(false)
  }

  const remove = (id) => {
    confirm(t('webhooks.incoming.removeConfirm'), async () => {
      await api.delete(`/webhooks/${id}`).catch(() => {})
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
    }, { danger: true })
  }

  const copyUrl = (token) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <PageTitle style={{ marginBottom: 4 }}>{t('webhooks.incoming.title')}</PageTitle>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{t('webhooks.incoming.subtitle')}</p>

      {/* New webhook */}
      <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <SectionTitle as="div" style={{ marginBottom: 12 }}>{t('webhooks.incoming.newWebhook')}</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('webhooks.incoming.namePlaceholder')}
            style={{ ...fieldInputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('webhooks.incoming.descPlaceholder')}
            style={{ ...fieldInputStyle, flex: 1 }} />
        </div>
        <Button variant="primary" onClick={create} disabled={!name.trim() || creating}>
          <Plus size={13} /> {creating ? t('webhooks.incoming.creating') : t('webhooks.incoming.create')}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <Caption>{t('common.loadingShort')}</Caption>
      ) : webhooks.length === 0 ? (
        <Caption>{t('webhooks.incoming.empty')}</Caption>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {webhooks.map((wh) => (
            <div key={wh.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                {editId === wh.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('webhooks.incoming.namePlaceholder')}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(wh.id)}
                      style={{ ...fieldInputStyle, height: 32, fontWeight: 600 }} />
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={t('webhooks.incoming.descPlaceholder')}
                      style={{ ...fieldInputStyle, height: 30, fontSize: 12 }} />
                  </div>
                ) : (
                  <div style={{ minWidth: 0 }}>
                    <SectionTitle as="div">{wh.name}</SectionTitle>
                    {wh.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wh.description}</div>}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {wh.last_triggered_at && editId !== wh.id && (
                    <Caption>
                      {t('webhooks.incoming.lastTriggered')}: {formatDateTime(wh.last_triggered_at)}
                    </Caption>
                  )}
                  {editId === wh.id ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => saveEdit(wh.id)} title={t('common.save')}
                        style={{ width: 28 }}>
                        <Save size={12} />
                      </Button>
                      <Button variant="secondary" size="sm" iconOnly onClick={() => setEditId(null)}
                        aria-label={t('common.cancel')} title={t('common.cancel')}>
                        <X size={12} />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* WEBHOOK-LOG-FE-1: opens the request log drill-in for this webhook. */}
                      <Button variant="secondary" size="sm" iconOnly onClick={() => setRequestsFor({ id: wh.id, name: wh.name })}
                        aria-label={t('webhooks.incoming.requests.viewButton')} title={t('webhooks.incoming.requests.viewButton')}>
                        <Inbox size={12} />
                      </Button>
                      <Button variant="secondary" size="sm" iconOnly onClick={() => startEdit(wh)}
                        aria-label={t('common.edit')} title={t('common.edit')}>
                        <Edit2 size={12} />
                      </Button>
                    </>
                  )}
                  <Button variant="dangerSoft" size="sm" iconOnly onClick={() => remove(wh.id)}
                    aria-label={t('webhooks.incoming.removeConfirm')} title={t('webhooks.incoming.removeConfirm')}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mono as="code" style={{ flex: 1, fontSize: 11, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', wordBreak: 'break-all' }}>
                  {BASE_URL}/{wh.token}
                </Mono>
                <Button variant="secondary" size="sm" onClick={() => copyUrl(wh.token)}>
                  {copied === wh.token ? <Check size={11} /> : <Copy size={11} />} {copied === wh.token ? t('common.copied') : t('webhooks.incoming.copyUrl')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {dialog}
      {requestsFor && (
        <WebhookRequestsPanel webhookId={requestsFor.id} webhookName={requestsFor.name} onClose={() => setRequestsFor(null)} />
      )}
    </div>
  )
}
