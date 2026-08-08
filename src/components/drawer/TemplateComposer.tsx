/**
 * TemplateComposer — what the recruiter sees when Meta's 24h window is NOT open
 * (WA-WINDOW-1, Danny punt 12). The old screen just hid the input and printed one
 * muted sentence, which answered "why" but never "so what do I do now?". Outside
 * the window WhatsApp only accepts a pre-APPROVED template, so that is exactly
 * what this offers: the reason, a searchable template picker (§4 — never a native
 * <select>), the message as the candidate will receive it, and a real send button.
 *
 * Honest gating, no fake affordances (§3):
 *  - a thread without a candidate (a customer-contact thread) gets a plain notice —
 *    POST /conversations/start is candidate-scoped, so there is nothing to press;
 *  - zero approved templates / zero sender numbers is a CONFIGURATION state, with a
 *    link straight to Settings → WhatsApp;
 *  - a template carrying {{n}} variables blocks the send with the reason, because
 *    the endpoint cannot carry values for them yet (see useWhatsAppTemplateSend).
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Send } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useWhatsAppTemplateSend } from './useWhatsAppTemplateSend'
import type { Id } from '@/types/common'

// Shared field footprint for both pickers — one look, never two drifting inputs.
const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }
const fieldFootprint: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 12 }

// A configuration gap (no templates / no sender number) with the fix one click away.
function ConfigNotice({ text }: { text: string }) {
  const { t } = useTranslation('candidates')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3, fontSize: 11, color: 'var(--color-danger)' }}>
      <span>{text}</span>
      <a href="#settings/whatsapp/whatsapp" style={{ color: 'var(--color-primary-text)', fontWeight: 600, textDecoration: 'none' }}>
        {t('conversations.configureWhatsapp')}
      </a>
    </div>
  )
}

export default function TemplateComposer({ candidateId, windowKnown, onSent }: {
  // The thread's candidate — null on a customer-contact thread (see the gate below).
  candidateId?: Id | null
  // False when the payload carried no usable 24h anchor: say so, never guess.
  windowKnown: boolean
  // Fired after a real send so the host reloads the thread + list from the server.
  onSent: () => void
}) {
  const { t } = useTranslation('candidates')
  const templateLabelId = useId()
  const numberLabelId = useId()
  const {
    loading, templates, numbers, templateName, pickTemplate,
    phoneNumberId, setPhoneNumberId, texts, variableCount,
    sending, error, canSend, submit,
  } = useWhatsAppTemplateSend(candidateId, onSent)

  const hasPreview = Boolean(texts.header || texts.body || texts.footer)

  return (
    <div style={{ marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Why free text is not the way here — icon + text, colour is never the only cue (§6). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        <Clock size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{windowKnown ? t('conversations.sessionClosedHint') : t('conversations.windowUnknown')}</span>
      </div>

      {/* A contact thread has no candidate to start from — an honest dead end, not a dead button. */}
      {!candidateId ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{t('conversations.templateNeedsCandidate')}</div>
      ) : loading ? (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{t('conversations.templateLoading')}</div>
      ) : (
        <>
          {/* Template — searchable, pick-only: approved templates only, never a typed name. */}
          <div style={{ marginTop: 8 }}>
            <div id={templateLabelId} style={fieldLabel}>{t('conversations.pickTemplate')}</div>
            <CreatableSelect value={templateName || null} onChange={pickTemplate} aria-labelledby={templateLabelId}
              allowCreate={false} placeholder={t('conversations.templatePlaceholder')} menuWidth={300}
              style={fieldFootprint} options={templates.map(tpl => ({ value: tpl.value, label: tpl.label }))} />
            {templates.length === 0 && <ConfigNotice text={t('conversations.templatesEmpty')} />}
          </div>

          {/* Sender number — asked only when the tenant really has a choice to make. */}
          {numbers.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div id={numberLabelId} style={fieldLabel}>{t('conversations.pickNumber')}</div>
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
              <div style={fieldLabel}>{t('conversations.preview')}</div>
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
            <button onClick={submit} disabled={!canSend}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', fontSize: 12, fontWeight: 500,
                border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)',
                cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.45 }}>
              <Send size={12} />
              {sending ? t('common:saving') : t('conversations.sendTemplate')}
            </button>
          </div>

          {/* The server's own reason (409) or our honest gateway notice (502), inline. */}
          {error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--color-danger)' }}>
              <AlertTriangle size={11} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
