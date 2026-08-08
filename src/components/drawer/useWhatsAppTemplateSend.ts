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
 * read-only verified). It accepts NO variables: the controller passes
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

export function useWhatsAppTemplateSend(candidateId: Id | null | undefined, onSent: () => void) {
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

  const selected = useMemo(() => templates.find(tpl => tpl.value === templateName), [templates, templateName])
  const texts = useMemo(() => templateTexts(selected?.components), [selected])
  // How many {{n}} slots this template needs filled — the blocker described above.
  const variableCount = useMemo(
    () => slotCount(texts.header) + slotCount(texts.body),
    [texts.header, texts.body]
  )

  // Everything the send needs, and nothing the API would silently drop.
  const canSend = Boolean(candidateId) && Boolean(templateName) && Boolean(phoneNumberId)
    && variableCount === 0 && !sending

  // Send the template through the one real route. 409 = the sender itself declined
  // (governor cap / opt-out / dedup) and carries its own readable reason; 502 = Meta
  // or the gateway is unreachable and NOTHING was sent; both stay inline.
  const submit = useCallback(async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await api.post('/conversations/start', {
        candidate_id: candidateId,
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
  }, [canSend, candidateId, phoneNumberId, templateName, selected, onSent, t])

  // Picking another template invalidates the previous failure message.
  const pickTemplate = useCallback((value: string) => { setTemplateName(value); setError(null) }, [])

  return {
    loading, templates, numbers, templateName, pickTemplate,
    phoneNumberId, setPhoneNumberId, texts, variableCount,
    sending, error, canSend, submit,
  }
}
