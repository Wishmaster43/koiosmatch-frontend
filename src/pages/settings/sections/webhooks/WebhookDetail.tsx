import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Save, Webhook, X } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { CredentialActionMenu } from '@/pages/settings/components/CredentialActionMenu'
import CalloutBox from '@/components/ui/CalloutBox'
import { useConfirm } from '@/hooks/useConfirm'
import { getSubscription, updateSubscription, deleteSubscription, regenerateSecret } from './webhooksApi'
import EventCatalog from './EventCatalog'
import SettingsDetailHeader from '@/pages/settings/components/SettingsDetailHeader'
import SecretRevealBox from '@/pages/settings/components/SecretRevealBox'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import { SectionTitle, BodyText, Mono } from '@/components/ui/typography'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

// hand-written: the spec carries no 2xx schema for GET/PUT /webhook-subscriptions/{id}
interface WebhookSubscription {
  id: string
  name: string
  url: string
  events: string[]
  status?: 'active' | 'disabled'
}

// hand-written: the spec carries no 2xx schema for POST .../regenerate-secret
interface RegenerateSecretResponse {
  signing_secret?: string
  secret?: string
}

interface WebhookDetailProps {
  /** The subscription id to load full detail for. */
  subId: string
  /** The list's own row, shown immediately while the full detail loads. */
  listRow?: WebhookSubscription
  /** Returns to the list view. */
  onBack: () => void
  /** Notifies the parent list of a merged patch, so the row stays in sync. */
  onPatch?: (id: string, merged: WebhookSubscription) => void
  /** Notifies the parent list that this subscription was deleted. */
  onDelete?: (id: string) => void
}

/**
 * WebhookDetail — the per-subscription detail (replaces the list). A header
 * (back, name, status, Action menu) over two cards: the editable name + URL, and
 * the event filter. Status toggle, secret regeneration (one-time banner) and
 * deletion live in the Action menu and bubble back to the list via onPatch/onDelete.
 */
export default function WebhookDetail({ subId, listRow, onBack, onPatch, onDelete }: WebhookDetailProps) {
  const { t } = useTranslation('settings')
  const [sub, setSub]         = useState<WebhookSubscription | null>(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<Partial<WebhookSubscription>>(listRow ?? { name: '', url: '' })
  const [events, setEvents]   = useState<string[]>(listRow?.events ?? [])
  const [savingEv, setSavingEv] = useState(false)
  const [savedEv, setSavedEv]   = useState(false)
  const [secret, setSecret]   = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  // Fetch full detail; fall back to the list row on failure.
  useEffect(() => {
    let active = true
    getSubscription(subId)
      .then((res: unknown) => { const full = res as WebhookSubscription; if (active) { setSub((p) => ({ ...p, ...full })); setForm((f) => ({ ...f, ...full })); setEvents(full.events ?? []) } })
      .catch(() => { /* keep listRow */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subId])

  // Persist a partial change and reflect it locally + in the parent list.
  const applyUpdate = async (patch: Partial<WebhookSubscription>) => {
    const updated = await updateSubscription(subId, patch) as Partial<WebhookSubscription>
    const merged = { ...sub, ...patch, ...updated } as WebhookSubscription
    setSub(merged)
    onPatch?.(subId, merged)
    return merged
  }

  const statusMap = {
    active:   { label: t('webhooks.outgoing.status.active'),   bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
    disabled: { label: t('webhooks.outgoing.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Save name + url (the editable card). A rejected save must tell the admin (§0/§13).
  const saveDetails = async () => {
    try { await applyUpdate({ name: form.name, url: form.url }); setEditing(false) }
    catch (err) { notifyError(extractApiError(err, t('common:actionFailed'))) }
  }
  // Save the event filter. A rejected save must tell the admin (§0/§13).
  const saveEvents = async () => {
    setSavingEv(true)
    try { await applyUpdate({ events }); setSavedEv(true); setTimeout(() => setSavedEv(false), 1800) }
    catch (err) { notifyError(extractApiError(err, t('common:actionFailed'))) }
    setSavingEv(false)
  }

  // Header actions.
  // AUDIT-BE-1-15: confirm first — regenerating rotates the signing secret, so the
  // OLD one stops working immediately for anyone still using it.
  // The backend returns the key as signing_secret; secret is a legacy fallback.
  const regenerate = () => {
    confirm(t('webhooks.outgoing.regenerateConfirm'), async () => {
      try { const res: RegenerateSecretResponse = await regenerateSecret(subId); setSecret(res?.signing_secret ?? res?.secret ?? null) }
      catch (err) { notifyError(extractApiError(err, t('common:actionFailed'))) }
    }, { danger: true })
  }
  const toggleStatus = () => applyUpdate({ status: (sub?.status ?? 'active') === 'active' ? 'disabled' : 'active' }).catch((err: unknown) => notifyError(extractApiError(err, t('common:actionFailed'))))
  // Confirms then deletes the subscription, bubbling the removal back to the list.
  const remove = () => {
    confirm(t('webhooks.outgoing.deleteConfirm', { name: sub?.name ?? '' }), async () => {
      try { await deleteSubscription(subId); onDelete?.(subId) }
      catch (err) { notifyError(extractApiError(err, t('common:actionFailed'))) }
    }, { danger: true })
  }

  if (!sub) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>

  const eventsDirty = JSON.stringify([...events].sort()) !== JSON.stringify([...(sub.events ?? [])].sort())
  // Canon field style (G33/fieldMetrics) — already matched it exactly, now shared.
  const inputStyle = fieldInputStyle
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }

  return (
    <div>
      <SettingsDetailHeader
        onBack={onBack}
        backLabel={t('common.back')}
        icon={Webhook}
        title={sub.name}
        statusBadge={<StatusBadge status={sub.status ?? 'active'} map={statusMap} />}
        loading={loading}
        actions={
          <CredentialActionMenu
            actionLabel={t('webhooks.outgoing.action')}
            regenerateLabel={t('webhooks.outgoing.regenerate')}
            activateLabel={t('webhooks.outgoing.activate')}
            deactivateLabel={t('webhooks.outgoing.deactivate')}
            deleteLabel={t('webhooks.outgoing.delete')}
            status={sub.status}
            onRegenerate={regenerate}
            onToggleStatus={toggleStatus}
            onDelete={remove}
          />
        }
      />

      {/* One-time secret banner after regenerate */}
      {secret && (
        <div style={{ margin: '14px 0' }}>
          <CalloutBox
            variant="success"
            title={t('webhooks.outgoing.secretOnce')}
            onDismiss={() => setSecret(null)}
            dismissLabel={t('webhooks.outgoing.dismiss')}
          >
            <SecretRevealBox
              secret={secret}
              copyLabel={t('webhooks.outgoing.copySecret')}
              copiedLabel={t('common.copied')}
            />
          </CalloutBox>
        </div>
      )}

      {/* Details card (name + url) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, margin: '18px 0', maxWidth: 680 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: editing ? 14 : 0 }}>
          <SectionTitle as="span">{t('webhooks.outgoing.detailsTitle')}</SectionTitle>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => { setForm(sub); setEditing(false) }}><X size={13} /> {t('common.cancel')}</Button>
              <Button variant="primary" onClick={saveDetails}><Save size={13} /> {t('common.save')}</Button>
            </div>
          ) : (
            // HUISSTIJL-1: the house Button (variant="soft") — solid tenant trio.
            <Button variant="soft" onClick={() => setEditing(true)}><Pencil size={13} /> {t('webhooks.outgoing.edit')}</Button>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>{t('webhooks.outgoing.field.name')}</label>
              <input value={form.name ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('webhooks.outgoing.field.url')}</label>
              <input
                value={form.url ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, url: e.target.value }))}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the input element itself must carry the font; the Mono atom renders a separate element and cannot apply to native input text
                style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>
        ) : (
          <BodyText as="div" style={{ marginTop: 12 }}>
            <Mono as="code" style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{sub.url}</Mono>
          </BodyText>
        )}
      </div>

      {/* Event filter card */}
      <div style={{ maxWidth: 680 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <SectionTitle as="span">{t('webhooks.outgoing.field.events')}</SectionTitle>
          <SaveButton onClick={saveEvents} disabled={!eventsDirty || savingEv} saved={savedEv}>
            {savedEv ? <><Check size={13} /> {t('common.saved')}</> : savingEv ? <><Spinner size={13} /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
          </SaveButton>
        </div>
        <EventCatalog value={events} onChange={setEvents} />
      </div>
      {dialog}
    </div>
  )
}
