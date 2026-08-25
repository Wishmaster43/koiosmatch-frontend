/**
 * TemplateComposer — what the recruiter sees when Meta's 24h window is NOT open
 * (WA-WINDOW-1, Danny punt 12). The old screen just hid the input and printed one
 * muted sentence, which answered "why" but never "so what do I do now?". Outside
 * the window WhatsApp only accepts a pre-APPROVED template, so that is exactly
 * what this offers: the reason, a searchable template picker (§4 — never a native
 * <select>), the message as the candidate will receive it, and a real send button.
 *
 * CONTACT-CONVERSATION-START (K-190): POST /conversations/start now accepts
 * customer_contact_id as well as candidate_id (strict XOR, postConversationsStart in
 * src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)), so a customer-contact thread sends a
 * template through the exact same route — the old "no candidate → dead end" notice
 * only fires when NEITHER owner is known at all (a genuinely unresolvable thread).
 *
 * Honest gating, no fake affordances (§3):
 *  - a thread whose owner is unknown gets a plain notice — nothing to press;
 *  - zero approved templates / zero sender numbers is a CONFIGURATION state, with a
 *    link straight to Settings → WhatsApp;
 *  - a template carrying {{n}} variables blocks the send with the reason, because
 *    the endpoint cannot carry values for them yet (see useWhatsAppTemplateSend).
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Send } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useWhatsAppTemplateSend, type ConversationSubject } from './useWhatsAppTemplateSend'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'

// Shared field footprint for both pickers — one look, never two drifting inputs.
const fieldFootprint: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 12 }

// A configuration gap (no templates / no sender number) with the fix one click away.
function ConfigNotice({ text }: { text: string }) {
  const { t } = useTranslation('candidates')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3, fontSize: 11, color: 'var(--color-danger-text)' }}>
      <span>{text}</span>
      {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline text link (colour+weight only, no fill/border/padding), not a button-shaped affordance */}
      <a href="#settings/whatsapp/whatsapp" style={{ color: 'var(--color-primary-text)', fontWeight: 600, textDecoration: 'none' }}>
        {t('conversations.configureWhatsapp')}
      </a>
    </div>
  )
}

export default function TemplateComposer({ candidateId, subject, windowKnown, onSent }: {
  // DEPRECATED legacy shape — kept so existing candidate-only call sites/tests stay
  // byte-compatible. Prefer `subject`, which also covers a customer-contact thread.
  candidateId?: Id | null
  // CONTACT-CONVERSATION-START: the thread's owner ({kind,id}) — null only when
  // neither a candidate nor a customer contact is known for this thread at all.
  subject?: ConversationSubject | null
  // False when the payload carried no usable 24h anchor: say so, never guess.
  windowKnown: boolean
  // Fired after a real send so the host reloads the thread + list from the server.
  onSent: () => void
}) {
  const { t } = useTranslation('candidates')
  const templateLabelId = useId()
  const numberLabelId = useId()
  // Prefer the explicit subject; fall back to the legacy bare candidate id.
  const resolvedSubject: ConversationSubject | null =
    subject ?? (candidateId ? { kind: 'candidate', id: candidateId } : null)
  const {
    loading, templates, numbers, templateName, pickTemplate,
    phoneNumberId, setPhoneNumberId, texts, variableCount,
    sending, error, canSend, submit,
  } = useWhatsAppTemplateSend(resolvedSubject, onSent)

  const hasPreview = Boolean(texts.header || texts.body || texts.footer)

  return (
    <div style={{ marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Why free text is not the way here — icon + text, colour is never the only cue (§6). */}
      <Caption as="div" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Clock size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{windowKnown ? t('conversations.sessionClosedHint') : t('conversations.windowUnknown')}</span>
      </Caption>

      {/* CONTACT-CONVERSATION-START: only a thread with NO known owner at all (neither
          candidate nor customer contact) hits this dead end — everything else, contact
          threads included, sends through the same route below. */}
      {!resolvedSubject ? (
        <Caption as="div" style={{ marginTop: 6 }}>{t('conversations.templateNeedsCandidate')}</Caption>
      ) : loading ? (
        <Caption as="div" style={{ marginTop: 6 }}>{t('conversations.templateLoading')}</Caption>
      ) : (
        <>
          {/* Template — searchable, pick-only: approved templates only, never a typed name. */}
          <div style={{ marginTop: 8 }}>
            <Caption as="div" id={templateLabelId} style={{ marginBottom: 4 }}>{t('conversations.pickTemplate')}</Caption>
            <CreatableSelect value={templateName || null} onChange={pickTemplate} aria-labelledby={templateLabelId}
              allowCreate={false} placeholder={t('conversations.templatePlaceholder')} menuWidth={300}
              style={fieldFootprint} options={templates.map(tpl => ({ value: tpl.value, label: tpl.label }))} />
            {templates.length === 0 && <ConfigNotice text={t('conversations.templatesEmpty')} />}
          </div>

          {/* Sender number — asked only when the tenant really has a choice to make. */}
          {numbers.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <Caption as="div" id={numberLabelId} style={{ marginBottom: 4 }}>{t('conversations.pickNumber')}</Caption>
              <CreatableSelect value={phoneNumberId || null} onChange={setPhoneNumberId} aria-labelledby={numberLabelId}
                allowCreate={false} placeholder={t('conversations.numberPlaceholder')} menuWidth={300}
                style={fieldFootprint} options={numbers} />
            </div>
          )}
          {numbers.length === 0 && <ConfigNotice text={t('conversations.numbersEmpty')} />}

          {/* The message as the candidate receives it — unfilled {{n}} slots are shown
              literally, because that is exactly what the endpoint would send today. */}
          {hasPreview && (
            <div style={{ marginTop: 8 }}>
              <Caption as="div" style={{ marginBottom: 4 }}>{t('conversations.preview')}</Caption>
              <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: '10px 10px 10px 2px', padding: '8px 10px', fontSize: 12, color: 'var(--text)' }}>
                {texts.header && <div style={{ fontWeight: 700, marginBottom: 4, whiteSpace: 'pre-wrap' }}>{texts.header}</div>}
                {texts.body && <div style={{ whiteSpace: 'pre-wrap' }}>{texts.body}</div>}
                {texts.footer && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{texts.footer}</div>}
              </div>
            </div>
          )}

          {/* The endpoint carries no variable values yet — say it here rather than let
              Meta reject the send afterwards. */}
          {variableCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 8, fontSize: 11, color: 'var(--color-warning)' }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('conversations.templateVarsUnsupported', { count: variableCount })}</span>
            </div>
          )}

          {/* Send — disabled whenever the send could not actually go through. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" size="sm" onClick={submit} disabled={!canSend}>
              <Send size={12} />
              {sending ? t('common:saving') : t('conversations.sendTemplate')}
            </Button>
          </div>

          {/* The server's own reason (409) or our honest gateway notice (502), inline. */}
          {error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--color-danger-text)' }}>
              <AlertTriangle size={11} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
