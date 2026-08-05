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
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { templateTexts, type WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import type { Id } from '@/types/common'

// GET /whatsapp-phone-numbers option shape — the tenant's active WhatsApp senders.
interface PhoneNumberOption { value: string; label: string }

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 60 }
const panel: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }
const fieldLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
// Consistent searchable-menu footprint (mirrors AddApplicationModal's pickers).
const pickerMenuWidth = 340
const fieldFootprint: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

export default function StartConversationModal({ candidateId, onClose, onStarted }: {
  candidateId: Id
  onClose: () => void
  // Fired after a successful send so the host can refresh its threads list.
  onStarted: () => void
}) {
  const { t } = useTranslation('candidates')
  const [templates, setTemplates] = useState<WaTemplateOption[]>([])
  const [numbers, setNumbers] = useState<PhoneNumberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [sending, setSending] = useState(false)

  // Load the tenant's approved templates + active sender numbers once — the exact
  // lookups the workflow builder's WhatsApp step reads (never a second source).
  useEffect(() => {
    let alive = true
    Promise.all([
      api.get('/whatsapp-templates').then(r => unwrapList<WaTemplateOption>(r).rows),
      api.get('/whatsapp-phone-numbers').then(r => unwrapList<PhoneNumberOption>(r).rows),
    ]).then(([tpls, nums]) => {
      if (!alive) return
      setTemplates(tpls)
      setNumbers(nums)
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
  const submit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await api.post('/conversations/start', {
        candidate_id: candidateId, phone_number_id: phoneNumberId, template_name: templateName,
        language: selected?.language,
      })
      notifySuccess(t('conversations.started'))
      onStarted(); onClose()
    } catch (err) {
      // The server's own message is pointable (template rejected / governor skip /
      // no connection) — never collapse it to one generic string.
      notifyError(extractApiError(err, t('conversations.startFailed')))
    } finally { setSending(false) }
  }

  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('conversations.startModalTitle')} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('conversations.startModalTitle')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('common:loading')}</div>}

        {!loading && (
          <>
            {/* Template — searchable pick-only combobox: approved templates only, never a typed name. */}
            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>{t('conversations.pickTemplate')}</div>
              <CreatableSelect value={templateName || null} onChange={setTemplateName}
                placeholder={t('conversations.templatePlaceholder')} allowCreate={false} menuWidth={pickerMenuWidth}
                style={fieldFootprint} options={templates.map(tpl => ({ value: tpl.value, label: tpl.label }))} />
              {templates.length === 0 && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('conversations.templatesEmpty')}</div>}
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
            {numbers.length === 0 && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginBottom: 14 }}>{t('conversations.numbersEmpty')}</div>}

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
          <button onClick={onClose} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
          <button onClick={submit} disabled={!canSend}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.4 }}>
            {sending ? t('common:saving') : t('conversations.start')}
          </button>
        </div>
      </div>
    </>
  )
}
