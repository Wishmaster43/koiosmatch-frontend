/**
 * useWhatsAppTemplateSend — the data + submit behind the closed-window template
 * fallback (WA-WINDOW-1). Outside Meta's 24h window a free-text message is
 * refused by Meta, so the only real way to reach the candidate is an APPROVED
 * template. This hook owns that route end to end: load the tenant's approved
 * templates + sender numbers, hold the selection, and POST the send.
 *
 * It reuses the EXACT lookups the rest of the app already uses — GET
 * /whatsapp-templates and GET /whatsapp-phone-numbers (the same pair
 * StartConversationModal and the workflow builder read) — never a second
 * template source, and the shared parsing helpers from
 * components/layout/workflow/whatsappTemplate.
 *
 * MEASURED 08-08 against the live API (tenant yesway): 24 approved templates,
 * 3 sender numbers, and POST /conversations/start validates
 * candidate_id + phone_number_id + template_name, reusing the candidate's
 * EXISTING thread (ConversationStartController → WhatsAppBundleSender::send,
 * read-only verified).
 *
 * CONTACT-CONVERSATION-START (K-190, koiosmatch-api commit 01cd7285): the same
 * endpoint now accepts customer_contact_id as the XOR alternative to candidate_id
 * (postConversationsStart, src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)) — this hook
 * takes a `subject` ({kind,id}) instead of a bare candidate id so a contact thread
 * sends the exact same way, never a second code path.
 *
 * It accepts NO variables: the controller passes
 * `variables: []` / `headerVariables: []`, and WabaGraphClient then omits the
 * body component entirely — so a template that carries {{n}} slots is rejected
 * by Meta and surfaces as a 502. That is why `variableCount > 0` blocks the
 * send here with an honest reason instead of shipping a button that fails (§3).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifySuccess } from '@/lib/notify'
import { templateTexts, slotCount, type WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import type { Id } from '@/types/common'

// GET /whatsapp-phone-numbers option shape — the tenant's active WhatsApp senders.
export interface PhoneNumberOption { value: string; label: string }

// CONTACT-CONVERSATION-START: the subject a template send targets — one of the two
// XOR owners POST /conversations/start accepts. Defined here (the base hook) and
// reused by ConversationsSection/TemplateComposer/StartConversationModal, never
// redeclared per caller.
export interface ConversationSubject { kind: 'candidate' | 'customer_contact'; id: Id }

// Base hook for sending an approved WhatsApp template to a candidate or customer
// contact — loads templates/sender numbers, tracks the picked template's variable slots, and posts the send.
export function useWhatsAppTemplateSend(subject: ConversationSubject | null | undefined, onSent: () => void) {
  const { t } = useTranslation('candidates')
  const [templates, setTemplates] = useState<WaTemplateOption[]>([])
  const [numbers, setNumbers] = useState<PhoneNumberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [sending, setSending] = useState(false)
  // The inline failure text next to the picker — never a toast, so the chosen
  // template stays on screen and a retry is just pressing send again.
  const [error, setError] = useState<string | null>(null)

  // Load approved templates + active sender numbers once. Both are configuration:
  // an empty list is an honest "not set up yet", not a crash.
  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      api.get('/whatsapp-templates').then(r => unwrapList<WaTemplateOption>(r).rows).catch(() => [] as WaTemplateOption[]),
      api.get('/whatsapp-phone-numbers').then(r => unwrapList<PhoneNumberOption>(r).rows).catch(() => [] as PhoneNumberOption[]),
    ]).then(([tpls, nums]) => {
      if (!alive) return
      setTemplates(tpls)
      setNumbers(nums)
      // Exactly one active sender → pick it silently, nothing to ask the recruiter.
      if (nums.length === 1) setPhoneNumberId(nums[0].value)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Resolve the picked template's full definition, from which the variable-slot count below is derived.
  const selected = useMemo(() => templates.find(tpl => tpl.value === templateName), [templates, templateName])
  const texts = useMemo(() => templateTexts(selected?.components), [selected])
  // How many {{n}} slots this template needs filled — the blocker described above.
  const variableCount = useMemo(
    () => slotCount(texts.header) + slotCount(texts.body),
    [texts.header, texts.body]
  )

  // Everything the send needs, and nothing the API would silently drop.
  const canSend = Boolean(subject) && Boolean(templateName) && Boolean(phoneNumberId)
    && variableCount === 0 && !sending

  // Send the template through the one real route. CONTACT-CONVERSATION-START: the
  // XOR owner field is chosen from `subject.kind` — candidate_id for a candidate
  // thread, customer_contact_id for a customer-contact one, never both (postConversationsStart,
  // src/types/api-generated.ts operation postConversationsStart (CONTACT-CONVERSATION-START strict-XOR block)). 409 = the sender itself declined
  // (governor cap / opt-out / dedup) and carries its own readable reason; 502 = Meta
  // or the gateway is unreachable and NOTHING was sent; both stay inline.
  const submit = useCallback(async () => {
    if (!canSend || !subject) return
    setSending(true)
    setError(null)
    try {
      await api.post('/conversations/start', {
        ...(subject.kind === 'customer_contact' ? { customer_contact_id: subject.id } : { candidate_id: subject.id }),
        phone_number_id: phoneNumberId,
        template_name: templateName,
        ...(selected?.language ? { language: selected.language } : {}),
      })
      notifySuccess(t('conversations.templateSent'))
      setTemplateName('')
      onSent()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 502
        ? t('conversations.composerUnavailable')
        : extractApiError(err, t('conversations.templateSendFailed')))
    } finally {
      setSending(false)
    }
  }, [canSend, subject, phoneNumberId, templateName, selected, onSent, t])

  // Picking another template invalidates the previous failure message.
  const pickTemplate = useCallback((value: string) => { setTemplateName(value); setError(null) }, [])

  return {
    loading, templates, numbers, templateName, pickTemplate,
    phoneNumberId, setPhoneNumberId, texts, variableCount,
    sending, error, canSend, submit,
  }
}
