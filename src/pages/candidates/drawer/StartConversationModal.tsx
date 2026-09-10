/**
 * StartConversationModal — "Conversatie starten" from the candidate Communicatie tab
 * (WHATSAPP-COMPOSE-1, Danny 06-08, CMBE punchlist d3b6d7f0): opens a NEW WhatsApp
 * thread via POST /conversations/start. A cold start is a TEMPLATE send by Meta's own
 * rule (no 24h session exists yet for a fresh thread), so this modal never lets the
 * recruiter type free text — only the tenant's synced + APPROVED templates, fetched
 * from the SAME GET /whatsapp-templates endpoint the workflow builder's
 * WhatsappTemplateField already uses (reused here, never a second template source —
 * see components/layout/workflow/whatsappTemplate.ts for the shared parsing helpers).
 *
 * The backend also requires WHICH sender number to use (`phone_number_id`,
 * ConversationStartController) — most tenants configure exactly one, so a single
 * active number is picked silently; a tenant with several sees an extra picker, and
 * zero configured numbers disables Send with an honest reason instead of a
 * guaranteed 404.
 *
 * CONTACT-CONVERSATION-START (K-190, koiosmatch-api commit 01cd7285): the same
 * endpoint now accepts customer_contact_id as a strict XOR alternative to
 * candidate_id (postConversationsStart, src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)),
 * so this modal takes a `subject` ({kind,id}) that names WHICH one to send. The
 * legacy `candidateId` prop still works — it just resolves to a candidate subject —
 * so the existing candidate call site (CommunicationTab.tsx) stays byte-compatible.
 *
 * The preview intentionally shows the template's raw header/body/footer text,
 * including any unfilled `{{n}}` slots: ConversationStartController always sends
 * `variables: []` (no substitution UI exists for a cold start), so showing the
 * literal placeholder is the accurate preview — a filled-in mock value would lie
 * about what the candidate actually receives.
 *
 * CONV-START-AGENT-1: an OPTIONAL AI-agent picker pins who answers INBOUND replies
 * on this thread (`agent_id`, ConversationStartController — validated against THIS
 * tenant's own `ai_agents`, verified read-only in koiosmatch-api). A fetch hiccup on
 * /ai/agents degrades to an empty list rather than blocking the whole modal — the
 * picker has nothing to do with whether the template itself can send. An unknown or
 * another tenant's agent id comes back as a 422 field error (`errors.agent_id`),
 * shown next to the picker, never folded into the generic failure toast.
 *
 * WA-SEND-1 (Danny 10-09, Q1/Q4/Q5 via CMBE; BE DANNY-AVOND-BE-1 item 6): the modal now
 * carries a CHANNEL pill row in its title bar (TITELBALK-PILLS): WhatsApp Business = the
 * template path above, WhatsApp Web = a free-text message (max 1000) over a linked and
 * connected WhatsApp Web device — the logged-in user's own device preselected, the
 * tenant's branch devices as the fallback picker. POST /conversations/start with
 * `channel: 'wa_web'` answers 202 { outbox_id, status: 'queued' } (the drainer sends on
 * its own schedule), so the toast says "ingepland", never "verzonden"; a 409 (no consent)
 * or 422 (no mobile, no device) surfaces the server's own reason. No AI-agent field on
 * that path (the BE branch takes none).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import CreatableSelect from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { templateTexts, type WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import type { ConversationSubject } from '@/components/drawer/useWhatsAppTemplateSend'
import type { Id } from '@/types/common'
import type { AiAgent } from '@/types/ai'
import Button from '@/components/ui/Button'
import TitleBarPills from '@/components/ui/TitleBarPills'
import { PageTitle } from '@/components/ui/typography'
import { TextArea } from '@/components/forms/fields'
import { useWaWebSendDevices } from './useWaWebSendDevices'

// The two start channels — WABA's template send and WA Web's free text (WA-SEND-1).
type StartChannel = 'waba' | 'wa_web'
// The BE caps a manual WhatsApp Web message at 1000 characters (DANNY-AVOND-BE-1 item 6).
const WA_WEB_MESSAGE_MAX = 1000
// Where the user links their own WhatsApp Web device (Profiel → WhatsApp Web).
const PROFILE_HASH = '#profile'

// GET /whatsapp-phone-numbers option shape — the tenant's active WhatsApp senders.
interface PhoneNumberOption { value: string; label: string }
// GET /ai/agents mapped to the same {value,label} shape as every other picker here.
interface AgentOption { value: string; label: string }

const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
// Consistent searchable-menu footprint (mirrors AddApplicationModal's pickers).
const pickerMenuWidth = 340
const fieldFootprint: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

/**
 * ConfigNotice — a missing template/sender is a CONFIGURATION state, not a bug
 * (measured 08-08 on tenant yesway: the WhatsApp account exists but sits
 * 'inactive' with 0 synced numbers and 0 templates, so both lookups honestly
 * return zero rows). A bare red sentence left the recruiter stuck, so the notice
 * now names the fix and links straight to Settings → WhatsApp, where the sync
 * buttons live. Deep-link form mirrors SettingsPage's canonical
 * `#settings/<category>/<tab>`.
 */
function ConfigNotice({ text, t, style }: { text: string; t: (k: string, o?: Record<string, unknown>) => string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 4, ...style }}>
      <span>{text}</span>
      <Button href="#settings/whatsapp/whatsapp" variant="ghostAccent" size="sm" style={{ padding: 0, height: 'auto' }}>
        {t('conversations.configureWhatsapp')}
      </Button>
    </div>
  )
}

export default function StartConversationModal({ candidateId, subject, onClose, onStarted }: {
  // DEPRECATED legacy shape — kept so the existing candidate call site
  // (CommunicationTab.tsx) stays byte-compatible. Prefer `subject`.
  candidateId?: Id
  // CONTACT-CONVERSATION-START: the thread owner to start for — a candidate or a
  // customer contact.
  subject?: ConversationSubject
  onClose: () => void
  // Fired after a successful send so the host can refresh its threads list.
  onStarted: () => void
}) {
  const { t } = useTranslation('candidates')
  // Prefer the explicit subject; fall back to the legacy bare candidate id.
  const resolvedSubject: ConversationSubject | null =
    subject ?? (candidateId ? { kind: 'candidate', id: candidateId } : null)
  const [templates, setTemplates] = useState<WaTemplateOption[]>([])
  const [numbers, setNumbers] = useState<PhoneNumberOption[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [agentError, setAgentError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // WA-SEND-1: the channel, the free-text message and the sending device for WA Web.
  const { devices, ownId, loading: devicesLoading } = useWaWebSendDevices()
  const [channel, setChannel] = useState<StartChannel>('waba')
  const [message, setMessage] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [channelChosen, setChannelChosen] = useState(false)

  // Preselect once the devices are known (Danny Q4): own connected device → WA Web on
  // that device; branch devices only → WA Web with the picker; none → the template path.
  useEffect(() => {
    if (devicesLoading || channelChosen) return
    setChannelChosen(true)
    if (ownId) { setChannel('wa_web'); setDeviceId(ownId); return }
    if (devices.length > 0) setChannel('wa_web')
  }, [devicesLoading, channelChosen, ownId, devices])

  // Load the tenant's approved templates + active sender numbers once — the exact
  // lookups the workflow builder's WhatsApp step reads (never a second source).
  // CONV-START-AGENT-1: the AI-agent list rides along but is self-catching — a
  // hiccup there degrades to an empty (optional) picker, never blocks the modal.
  useEffect(() => {
    let alive = true
    Promise.all([
      api.get('/whatsapp-templates').then(r => unwrapList<WaTemplateOption>(r).rows),
      api.get('/whatsapp-phone-numbers').then(r => unwrapList<PhoneNumberOption>(r).rows),
      api.get('/ai/agents').then(r => unwrapList<AiAgent>(r).rows).catch(() => [] as AiAgent[]),
    ]).then(([tpls, nums, ags]) => {
      if (!alive) return
      setTemplates(tpls)
      setNumbers(nums)
      setAgents(ags.map(a => ({ value: String(a.id ?? ''), label: a.name ?? '' })))
      // Exactly one active sender → pick it silently, nothing to ask the recruiter.
      if (nums.length === 1) setPhoneNumberId(nums[0].value)
    }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const selected = templates.find(tpl => tpl.value === templateName)
  const texts = templateTexts(selected?.components)
  const hasPreview = Boolean(texts.header || texts.body || texts.footer)
  // The picker's options: every connected device, or the own device alone when the
  // tenant list hiccuped but the profile read did not (never a silently empty picker).
  const deviceOptions = devices.length > 0 ? devices : ownId ? [{ value: ownId, label: t('conversations.deviceOwn') }] : []
  const trimmedMessage = message.trim()
  const canSend = Boolean(resolvedSubject) && !sending && (channel === 'wa_web'
    ? Boolean(trimmedMessage) && trimmedMessage.length <= WA_WEB_MESSAGE_MAX && Boolean(deviceId)
    : Boolean(templateName && phoneNumberId))

  // Send the opening template — the server validates it against the synced+approved
  // set and only writes the thread once the send itself succeeded (CONV-START-1).
  // agent_id rides along only when actually picked (backend field is `sometimes`).
  // CONTACT-CONVERSATION-START: the XOR owner field follows resolvedSubject.kind —
  // candidate_id for a candidate, customer_contact_id for a customer contact.
  const submit = async () => {
    if (!canSend || !resolvedSubject) return
    setSending(true)
    setAgentError(null)
    const owner = resolvedSubject.kind === 'customer_contact'
      ? { customer_contact_id: resolvedSubject.id }
      : { candidate_id: resolvedSubject.id }
    try {
      if (channel === 'wa_web') {
        // WA-SEND-1: the queued outbox path — 202 { outbox_id, status: 'queued' }: the toast
        // says scheduled, never sent; the thread shows the outbox status (WA-SEND-STATUS-1).
        await api.post('/conversations/start', { ...owner, channel: 'wa_web', message: trimmedMessage, whatsapp_number_id: deviceId })
        notifySuccess(t('conversations.queued'))
      } else {
        await api.post('/conversations/start', {
          ...owner,
          phone_number_id: phoneNumberId, template_name: templateName,
          language: selected?.language,
          ...(agentId ? { agent_id: agentId } : {}),
        })
        notifySuccess(t('conversations.started'))
      }
      onStarted(); onClose()
    } catch (err) {
      // CONV-START-AGENT-1: an unknown/foreign agent id is its OWN 422 field error
      // (Laravel's exists:ai_agents,id) — shown next to the picker, never folded into
      // the generic toast so the recruiter knows exactly which choice to redo.
      const fieldErrors = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors
      if (fieldErrors?.agent_id) {
        setAgentError(fieldErrors.agent_id[0])
      } else {
        // The server's own message is pointable (template rejected / governor skip /
        // no connection) — never collapse it to one generic string.
        notifyError(extractApiError(err, t('conversations.startFailed')))
      }
    } finally { setSending(false) }
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // remembered position; same 420px footprint as the old panel.
    <FloatingPanel open onClose={onClose} title={t('conversations.startModalTitle')} ariaLabel={t('conversations.startModalTitle')}
      persistKey="start-conversation" width={420} maxWidth="92vw" bodyStyle={{ padding: 22 }}
      header={
        // TITELBALK-PILLS: the channel is the short choice in the title bar, one shared pill row.
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <PageTitle as="span">{t('conversations.startModalTitle')}</PageTitle>
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <TitleBarPills value={channel} onChange={v => { setChannel(v as StartChannel); setChannelChosen(true) }} ariaLabel={t('conversations.channel')}
              options={[{ value: 'waba', label: t('conversations.channelWaba') }, { value: 'wa_web', label: t('conversations.channelWaWeb') }]} />
          </div>
        </div>
      }>

        {(loading || devicesLoading) && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('common:loading')}</div>}

        {/* WA-SEND-1: WhatsApp Web — free text over a linked device, no template, no agent field. */}
        {!devicesLoading && channel === 'wa_web' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>{t('conversations.message')}</div>
              {/* Plain text on purpose: a WhatsApp message travels as text, never HTML (the
                  reply composer on the thread is the same plain field). */}
              <TextArea value={message} onChange={setMessage} placeholder={t('conversations.messagePlaceholder')} rows={4} style={fieldFootprint} />
              <div style={{ fontSize: 11, color: trimmedMessage.length > WA_WEB_MESSAGE_MAX ? 'var(--color-danger-text)' : 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>
                {/* GETALLEN-1 through i18next's own number formatting ({{n, number}}) — lib/formatters
                    would drag lib/datetime and the i18n init into every consumer of this modal
                    (DATETIME-IMPORT-LES). */}
                {t('conversations.messageCount', { count: trimmedMessage.length, max: WA_WEB_MESSAGE_MAX })}
              </div>
            </div>
            {/* The sending device: the own device is picked silently; more than one connected
                device (own + branch) shows the picker, the own device first (Danny Q4). */}
            {deviceOptions.length > 1 && (
              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabel}>{t('conversations.pickDevice')}</div>
                <CreatableSelect value={deviceId || null} onChange={setDeviceId}
                  placeholder={t('conversations.numberPlaceholder')} allowCreate={false} menuWidth={pickerMenuWidth}
                  style={fieldFootprint} options={deviceOptions.map(d => ({ value: d.value, label: d.owner ? `${d.label} · ${d.owner}` : d.label }))} />
              </div>
            )}
            {deviceOptions.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span>{t('conversations.devicesEmpty')}</span>
                <Button href={PROFILE_HASH} variant="ghostAccent" size="sm" style={{ padding: 0, height: 'auto' }}>{t('conversations.linkDevice')}</Button>
              </div>
            )}
          </>
        )}

        {!loading && channel === 'waba' && (
          <>
            {/* Template — searchable pick-only combobox: approved templates only, never a typed name. */}
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>{t('conversations.pickTemplate')}</div>
              <CreatableSelect value={templateName || null} onChange={setTemplateName}
                placeholder={t('conversations.templatePlaceholder')} allowCreate={false} menuWidth={pickerMenuWidth}
                style={fieldFootprint} options={templates.map(tpl => ({ value: tpl.value, label: tpl.label }))} />
              {templates.length === 0 && <ConfigNotice text={t('conversations.templatesEmpty')} t={t} />}
            </div>

            {/* Sender number — only shown with more than one active number; a single
                configured number is picked silently above. */}
            {numbers.length > 1 && (
              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabel}>{t('conversations.pickNumber')}</div>
                <CreatableSelect value={phoneNumberId || null} onChange={setPhoneNumberId}
                  placeholder={t('conversations.numberPlaceholder')} allowCreate={false} menuWidth={pickerMenuWidth}
                  style={fieldFootprint} options={numbers} />
              </div>
            )}
            {numbers.length === 0 && <ConfigNotice text={t('conversations.numbersEmpty')} t={t} style={{ marginBottom: 14 }} />}

            {/* CONV-START-AGENT-1: optional — pins who answers inbound replies on this
                thread. Never required: a plain start with no agent stays fully supported. */}
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>{t('conversations.pickAgent')}</div>
              <CreatableSelect value={agentId || null} onChange={v => { setAgentId(v); setAgentError(null) }}
                placeholder={t('conversations.agentPlaceholder')} allowCreate={false} clearable menuWidth={pickerMenuWidth}
                style={fieldFootprint} options={agents} />
              {agentError && <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{agentError}</div>}
            </div>

            {/* Read-only preview of the picked template's own text — see the file
                comment on why unfilled {{n}} slots are shown as-is. */}
            {hasPreview && (
              <div style={{ marginBottom: 18 }}>
                <div style={fieldLabel}>{t('conversations.preview')}</div>
                <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: '10px 10px 10px 2px', padding: '8px 10px', fontSize: 12, color: 'var(--text)' }}>
                  {texts.header && <div style={{ fontWeight: 700, marginBottom: 4, whiteSpace: 'pre-wrap' }}>{texts.header}</div>}
                  {texts.body && <div style={{ whiteSpace: 'pre-wrap' }}>{texts.body}</div>}
                  {texts.footer && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{texts.footer}</div>}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>{t('common:cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={!canSend}>
            {sending ? t('common:saving') : channel === 'wa_web' ? t('conversations.send') : t('conversations.start')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
