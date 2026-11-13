/**
 * IncomingWebhooks — the existing INBOUND webhooks: token URLs that external
 * systems POST to in order to trigger a workflow (used by WorkflowCanvasEditor).
 * Ported unchanged in behaviour from the old WebhooksSettings; only the i18n keys
 * moved under webhooks.incoming.* and the base URL now derives from VITE_API_URL.
 * WEBHOOK-LOG-FE-1: each row also gets a "Verzoeken" (requests) button opening
 * the per-webhook request log (WebhookRequestsPanel) — the per-webhook drill-in
 * Danny asked for ("waar is mijn log wat er binnen zou moeten komen").
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Inbox, KeyRound, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import {
  listInboundWebhooks, createInboundWebhook, updateInboundWebhook, deleteInboundWebhook, regenerateInboundSecret,
} from './webhooksApi'
import { useConfirm } from '@/hooks/useConfirm'
import Button from '@/components/ui/Button'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { PageTitle, SectionTitle, Caption, PageSubtitle, monoStyle } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import WebhookRequestsPanel from '@/components/webhooks/WebhookRequestsPanel'
// OneTimeSecretReveal: the shared one-time-secret idiom (DL-02/WFB-06 adoption, ADOPT-A3b item 20).
import OneTimeSecretReveal from '@/pages/settings/components/OneTimeSecretReveal'
// DATUM-1: every user-visible date rides the house formatter, never toLocaleDateString.
import { useDateFormat } from '@/lib/datetime'
import { publicApiUrl } from '@/lib/publicApiUrl'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

// hand-written: the spec carries no 2xx schema for GET/POST /webhooks (responses: never).
// DL-02/WFB-06: POST /webhooks now returns the plaintext signing_secret once (require_signature
// defaults true), and POST /webhooks/{id}/regenerate-secret returns a fresh one the same way.
interface Webhook {
  id: string
  name: string
  description?: string | null
  token: string
  last_triggered_at?: string | null
  signing_secret?: string
}

// The one-time secret currently on screen (from create or from a regenerate) — never persisted beyond this state.
interface SecretReveal {
  title: string
  secret: string
}

// Which webhook's request log is open — the drill-in target.
interface RequestsTarget {
  id: string
  name: string
}

// Inbound webhook URLs are pasted into external systems — absolute, never /api-relative.
const BASE_URL = publicApiUrl('/webhook')

// Manages the tenant's inbound webhook tokens (see file docblock above) — create,
// in-place edit, delete, copy-URL, and the per-webhook request-log drill-in.
export default function IncomingWebhooks() {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState(false)
  // Bumped by the retry button to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0)
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState<string | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  // Which webhook's request log is open ({ id, name }) — the new drill-in.
  const [requestsFor, setRequestsFor] = useState<RequestsTarget | null>(null)
  // The one-time signing-secret banner (from create or "Secret vernieuwen") — cleared on Done.
  const [reveal, setReveal] = useState<SecretReveal | null>(null)
  // Verifier fix: the reveal renders above the list, off-screen from a regenerate click
  // further down the page — scroll it into view and move focus so it is never missed.
  const revealRef = useRef<HTMLDivElement>(null)
  // House confirmation dialog (§0 restschuld) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Start / save an in-place edit of an existing webhook (name + description).
  const startEdit = (wh: Webhook) => { setEditId(wh.id); setEditName(wh.name ?? ''); setEditDesc(wh.description ?? '') }
  // Commits the in-place edit: updates local state optimistically, then persists.
  const saveEdit = async (id: string) => {
    const nm = editName.trim(); if (!nm) return
    const description = editDesc.trim() || null
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, name: nm, description } : w)))
    setEditId(null)
    await updateInboundWebhook(id, { name: nm, description }).catch((err) => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Load the inbound webhooks for the active tenant; an alive guard drops a stale response,
  // a failure shows an error with retry instead of an innocent-looking empty list.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    listInboundWebhooks()
      .then((res) => { if (alive) setWebhooks(res.rows as Webhook[]) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  // Verifier fix: whenever a secret reveal appears (create or regenerate), scroll it
  // into view and focus it — the trigger for a regenerate is a row further down the list.
  useEffect(() => {
    if (reveal) { revealRef.current?.scrollIntoView?.({ block: 'center' }); revealRef.current?.focus() }
  }, [reveal])

  // Create a new inbound webhook (name + optional description). DL-02/WFB-06: the
  // response carries the plaintext signing_secret exactly once — surface it now,
  // since a missed reveal previously meant a webhook created dead (no way to sign).
  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = (await createInboundWebhook({ name: name.trim(), description: desc.trim() || null })) as Webhook
      setWebhooks((prev) => [...prev, created])
      if (created.signing_secret) setReveal({ title: t('webhooks.incoming.secretOnce'), secret: created.signing_secret })
      setName('')
      setDesc('')
    } catch (err) {
      // A failed create must tell the admin (§0/§13) — the api client's toast is DEV-only.
      notifyError(extractApiError(err, t('common:actionFailed')))
    }
    setCreating(false)
  }

  // "Secret vernieuwen" — rotates the signing secret via the recovery route
  // (DL-02/WFB-06): a webhook created dead (the one-time reveal was lost) gets a
  // fresh secret. Confirms first — the old secret stops working immediately.
  const regenerateSecret = (id: string) => {
    confirm(t('webhooks.incoming.regenerateConfirm'), async () => {
      try {
        const secret = (await regenerateInboundSecret(id) as Webhook | undefined)?.signing_secret
        // Verifier fix: the server has already rotated the secret by the time it responds —
        // a 200 without the field must not read as "nothing happened" and leave it unknown.
        if (secret) setReveal({ title: t('webhooks.incoming.secretOnce'), secret })
        else notifyError(t('common:actionFailed'))
      } catch (err) {
        notifyError(extractApiError(err, t('common:actionFailed')))
      }
    }, { danger: true })
  }

  // User asked to delete a webhook: confirms first (destructive), then removes it.
  const remove = (id: string) => {
    confirm(t('webhooks.incoming.removeConfirm'), async () => {
      await deleteInboundWebhook(id).catch((err) => notifyError(extractApiError(err, t('common:actionFailed'))))
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
    }, { danger: true })
  }

  // Copies the full webhook URL to the clipboard and shows temporary "copied" feedback.
  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <PageTitle style={{ marginBottom: 4 }}>{t('webhooks.incoming.title')}</PageTitle>
      <PageSubtitle as="p" style={{ marginBottom: 20 }}>{t('webhooks.incoming.subtitle')}</PageSubtitle>

      {/* One-time signing-secret reveal — from create or "Secret vernieuwen" (DL-02/WFB-06) */}
      {reveal && (
        <div ref={revealRef} tabIndex={-1} role="status" aria-live="polite" style={{ marginBottom: 24, outline: 'none' }}>
          <OneTimeSecretReveal
            title={reveal.title}
            secret={reveal.secret}
            copyLabel={t('webhooks.incoming.copySecret')}
            copiedLabel={t('common.copied')}
            doneLabel={t('webhooks.incoming.done')}
            onDone={() => setReveal(null)}
          />
        </div>
      )}

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
      ) : loadError ? (
        <ErrorBanner onRetry={() => setReloadKey((k) => k + 1)}>{t('webhooks.incoming.loadError')}</ErrorBanner>
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
                    {wh.description && <PageSubtitle as="div">{wh.description}</PageSubtitle>}
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
                      {/* DL-02/WFB-06: recovery path for a webhook created dead (secret reveal lost). */}
                      <Button variant="secondary" size="sm" iconOnly onClick={() => regenerateSecret(wh.id)}
                        aria-label={t('webhooks.incoming.regenerate')} title={t('webhooks.incoming.regenerate')}>
                        <KeyRound size={12} />
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
                <Caption as="code" style={{ ...monoStyle, flex: 1, background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', wordBreak: 'break-all' }}>
                  {BASE_URL}/{wh.token}
                </Caption>
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
