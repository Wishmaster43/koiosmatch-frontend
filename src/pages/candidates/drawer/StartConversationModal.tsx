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
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import CreatableSelect from '@/components/ui/CreatableSelect'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { templateTexts, type WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import type { Id } from '@/types/common'
import type { AiAgent } from '@/types/ai'
import Button from '@/components/ui/Button'

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
      <a href="#settings/whatsapp/whatsapp" style={{ color: 'var(--color-primary-text)', fontWeight: 600, textDecoration: 'none' }}>
        {t('conversations.configureWhatsapp')}
      </a>
    </div>
  )
}

export default function StartConversationModal({ candidateId, onClose, onStarted }: {
  candidateId: Id
  onClose: () => void
  // Fired after a successful send so the host can refresh its threads list.
  onStarted: () => void
}) {
  const { t } = useTranslation('candidates')
  const [templates, setTemplates] = useState<WaTemplateOption[]>([])
  const [numbers, setNumbers] = useState<PhoneNumberOption[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [agentError, setAgentError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

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
  const canSend = Boolean(templateName && phoneNumberId) && !sending

  // Send the opening template — the server validates it against the synced+approved
  // set and only writes the thread once the send itself succeeded (CONV-START-1).
  // agent_id rides along only when actually picked (backend field is `sometimes`).
  const submit = async () => {
    if (!canSend) return
    setSending(true)
    setAgentError(null)
    try {
      await api.post('/conversations/start', {
        candidate_id: candidateId, phone_number_id: phoneNumberId, template_name: templateName,
        language: selected?.language,
        ...(agentId ? { agent_id: agentId } : {}),
      })
      notifySuccess(t('conversations.started'))
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
      persistKey="start-conversation" width={420} maxWidth="92vw" bodyStyle={{ padding: 22 }}>

        {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('common:loading')}</div>}

        {!loading && (
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
            {sending ? t('common:saving') : t('conversations.start')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
