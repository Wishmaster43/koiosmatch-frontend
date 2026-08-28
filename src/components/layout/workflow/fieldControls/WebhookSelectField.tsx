/**
 * Webhook select field — lets a Webhook Trigger pick or inline-create an
 * inbound webhook from the same /webhooks resource as Settings, then shows the
 * receiving URL to hand to externals (Facebook, Intus, …). One webhook binds
 * to one workflow (Make-style). Split out of the former fieldControls.tsx monolith (§3 400-line split trigger).
 */
import { useState, useEffect, useId } from 'react'
import { Plus, X, Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { unwrap, unwrapList } from '@/lib/api'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
import { Caption, Mono } from '@/components/ui/typography'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Spinner from '@/components/ui/Spinner'
import type { OnChange } from './types'

// ── Webhook select field ────────────────────────────────────────────────────────
const WEBHOOK_API_URL = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
const WEBHOOK_BASE    = `${WEBHOOK_API_URL}/webhook`

// Lets a workflow's Webhook Trigger pick or inline-create an inbound webhook, then shows the receiving URL to hand to the external system (Facebook, Intus, …).
export function WebhookSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const [hooks,    setHooks]    = useState<Array<{ id?: string | number; name?: string; token?: string }>>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [creating, setCreating] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [copied,   setCopied]   = useState(false)
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4).
  const webhookLabelId = useId()

  // Load the tenant's inbound webhooks (same resource as Settings).
  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/webhooks'))
      .then(r => setHooks(unwrapList<{ id?: string | number; name?: string; token?: string }>(r).rows))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const selected = hooks.find(h => String(h.id) === String(value))

  // Create a new inbound webhook inline and select it immediately.
  const create = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const api = (await import('@/lib/api')).default
      const r   = await api.post('/webhooks', { name })
      const wh  = unwrap<{ id?: string | number; name?: string; token?: string }>(r)
      setHooks(prev => [...prev, wh])
      onChange(fieldKey, wh.id)
      setNewName(''); setShowNew(false)
    } catch { setError(true) }
    setCreating(false)
  }

  // Copy the receiving URL — the address external systems POST to.
  const copy = () => {
    if (!selected?.token) return
    navigator.clipboard.writeText(`${WEBHOOK_BASE}/${selected.token}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>{t('fields.webhookLoading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <div style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{t('fields.webhookError')}</div>}

      {/* Picker — existing inbound webhooks */}
      <span id={webhookLabelId} className="sr-only">{t('fields.webhookSelect')}</span>
      <CreatableSelect value={(value as string) || ''} onChange={v => onChange(fieldKey, v)}
        aria-labelledby={webhookLabelId} allowCreate={false}
        placeholder={hooks.length ? t('fields.webhookSelect') : t('fields.webhookEmpty')}
        options={[
          { value: '', label: hooks.length ? t('fields.webhookSelect') : t('fields.webhookEmpty') },
          ...hooks.map(h => ({ value: String(h.id ?? ''), label: h.name ?? String(h.id ?? '') })),
        ]}
        style={{ width: '100%', padding: '7px 9px', fontSize: 13 }} />

      {/* Inline create — mirrors Make's "Create a webhook" */}
      {showNew ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={t('fields.webhookNamePlaceholder')} aria-label={t('fields.webhookNamePlaceholder')} onKeyDown={e => e.key === 'Enter' && create()}
            style={{ flex: 1, padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
          <Button variant="primary" size="sm" onClick={create} disabled={!newName.trim() || creating}>
            {creating ? <Spinner size={11} /> : <Plus size={11} />} {t('fields.create')}
          </Button>
          <Button variant="secondary" size="sm" iconOnly onClick={() => { setShowNew(false); setNewName('') }}
            title={t('common:cancel')} aria-label={t('common:cancel')}>
            <X size={12} />
          </Button>
        </div>
      ) : (
        // HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A).
        <DrawerAddButton onClick={() => setShowNew(true)} label={t('fields.webhookCreate')} />
      )}

      {/* Receiving URL — what you give to the external system */}
      {selected?.token && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('fields.receivingUrl')}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Mono as="code" style={{ flex: 1, fontSize: 10, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', color: 'var(--text)', wordBreak: 'break-all' }}>
              {WEBHOOK_BASE}/{selected.token}
            </Mono>
            <button type="button" onClick={copy} title={t('fields.copyUrl')} aria-label={t('fields.copyUrl')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- copied-state success-feedback face (bg/ink pair swaps on state), matches no fixed Button variant; ChangelogPopover precedent
              style={{ padding: '6px 8px', background: copied ? 'var(--color-success-bg)' : 'var(--hover-bg)', color: copied ? 'var(--color-on-success-bg)' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <Caption as="div">{t('fields.webhookHint')}</Caption>
        </div>
      )}
    </div>
  )
}
