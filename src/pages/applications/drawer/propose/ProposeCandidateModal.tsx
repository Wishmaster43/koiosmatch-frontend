import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Info, Send, TriangleAlert } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { useActionRulePreflight, ActionRuleBanner, ActionRuleDialog } from '@/components/actionrules'
import type { ActionRuleDecision } from '@/components/actionrules'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { BTN_H } from '@/config/buttonMetrics'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { contactOptionLabel } from '@/lib/contactLabel'
import { useProposeForm } from './useProposeForm'
import type { ApplicationDetail } from '@/types/application'
import Button from '@/components/ui/Button'

const sectionTitle = { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 } as const
const muted = { fontSize: 11, color: 'var(--text-muted)' } as const
// Canon field style (G33/fieldMetrics) — was its own padding-7/font-13/radius-8 copy.
const inputBase = fieldInputStyle

// The strictest of two AXIS-MATRIX decisions wins (block > warn > allow) — this
// action touches BOTH the candidate axis and the customer axis (§3A).
function strictest(a?: ActionRuleDecision | null, b?: ActionRuleDecision | null): ActionRuleDecision | null {
  if (a?.effect === 'block') return a
  if (b?.effect === 'block') return b
  if (a?.effect === 'warn') return a
  if (b?.effect === 'warn') return b
  return a ?? b ?? null
}

interface Props {
  application: ApplicationDetail
  onClose: () => void
}

/**
 * ProposeCandidateModal — records a candidate proposal to the customer contact:
 * downloads the house-style CV client-side, drafts a subject + rich-text message
 * from the tenant's templates, and logs it as an application note (+ optional
 * funnel-phase move). Koios does NOT send anything itself — the honest line
 * above the footer says so, and there is deliberately no "Verzenden" button.
 * PROPOSE-SHARE-LINK-1 shipped on the backend: a successful record now returns
 * a real recipient-facing share_url, surfaced here with a copy button so the
 * recruiter never has to hunt for it in the ProposalsBlock history afterwards.
 *
 * V-appdetail-4: the message body gets an expand toggle (RichTextEditor's own
 * `expanded`/`onToggleExpand`, mirroring the rejection note). It deliberately
 * does NOT get the second-screen pop-out: `body` is un-persisted draft state of
 * this whole multi-field form (recipient, documents, CV variant, consent) that
 * only commits atomically on Verzenden — there is no standalone PATCH for the
 * body alone, so a pop-out window could only "save" by writing a field the
 * server has no route for, or by silently dropping every other field. Honest
 * skip (§3, no fake affordance) until proposals get their own draft-persistence
 * route.
 */
export default function ProposeCandidateModal({ application: a, onClose }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const form = useProposeForm(a)
  // V-appdetail-4: the propose body gets an expand toggle, mirroring the
  // rejection note's own RichTextEditor expand — no pop-out here (see this
  // file's own docblock: the body is un-persisted draft state of a multi-field
  // form, not a standalone saved field, so there is no real save path for a
  // second window to write through).
  const [bodyExpanded, setBodyExpanded] = useState(false)

  // Guard both axes this action touches — candidate.propose (sharing a health-
  // data record) and customer.propose (sharing it with this specific customer).
  const { decision: candidateDecision } = useActionRulePreflight('candidate.propose', { candidateId: String(a.candidateId ?? '') })
  const { decision: customerDecision } = useActionRulePreflight('customer.propose', { customerId: String(a.customerId ?? '') })
  const decision = strictest(candidateDecision, customerDecision)

  // A block outcome never opens the propose form — only the server's own text.
  if (decision?.effect === 'block') {
    return <ActionRuleDialog open decision={decision} onConfirm={onClose} onCancel={onClose} />
  }

  // The shared "Name — Function" label (same as every other contact picker) —
  // distinguishes same-named contacts on the customer, never a dangling separator.
  const contactOptions = form.contacts.map(c => ({ value: c.id, label: contactOptionLabel(c) }))

  // Human-readable reason the primary action is disabled (§3 — never a bare
  // greyed-out button with no explanation).
  const disabledText = form.disabledReason === 'loading' ? t('propose.loading')
    : form.disabledReason === 'noCandidate' ? t('candidateDetail.error')
    : form.disabledReason === 'noContact' ? t('propose.noContacts')
    : form.disabledReason === 'noConsent' ? t('propose.consentRequired')
    : null

  // V-appdetail-5: on success the modal stays open long enough to hand over the
  // share link (never auto-closes into it) — the recruiter closes it themselves
  // once they've copied/opened it, mirroring ProposalsBlock's own affordance.
  const handleSubmit = async () => {
    await form.submit()
  }

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onClose} ariaLabel={t('propose.title')}
      persistKey="application-propose" width={560} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}><Send size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('propose.title')}</span>
        </span>
      }>
        {decision?.effect === 'warn' && <div style={{ marginBottom: 12 }}><ActionRuleBanner decision={decision} /></div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Ontvanger — searchable, tenant-lookup style contact picker (no free entry). */}
          <div>
            <div style={sectionTitle}>{t('propose.recipient')}</div>
            {form.contactsLoading ? (
              <div style={muted}>{t('propose.loading')}</div>
            ) : contactOptions.length === 0 && !form.recipient ? (
              <div style={muted}>{t('propose.noContacts')}</div>
            ) : (
              <CreatableSelect allowCreate={false} value={form.recipientContactId || null}
                onChange={form.setRecipientContactId} options={contactOptions}
                placeholder={t('propose.recipientPlaceholder')} />
            )}
            {form.recipient && !form.recipient.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, color: 'var(--color-warning)' }}>
                <TriangleAlert size={12} /> {t('propose.recipientMissingEmail')}
              </div>
            )}
          </div>

          {/* 2. Documenten — the house-style CV is always included (not unselectable:
              without it this isn't a proposal); the motivation letter checkbox only
              shows when the candidate actually submitted one. */}
          <div>
            <div style={sectionTitle}>{t('propose.documents')}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', marginBottom: form.hasMotivation ? 6 : 0 }}>
              <input type="checkbox" checked disabled aria-label={t('propose.cvHouseStyle')} />
              {t('propose.cvHouseStyle')}
            </label>
            {form.hasMotivation && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                <input type="checkbox" checked={form.includeMotivation} onChange={e => form.setIncludeMotivation(e.target.checked)} />
                {t('propose.motivationLetter')}
              </label>
            )}
          </div>

          {/* 3. CV-variant — the AVG control: which fields the proposal variant hides
              is spelled out right here, not buried in a settings page. */}
          <div>
            <div style={sectionTitle}>{t('propose.variantTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                <input type="radio" name="cvVariant" checked={form.cvVariant === 'proposal'} onChange={() => form.setCvVariant('proposal')} />
                {t('propose.variantProposal')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                <input type="radio" name="cvVariant" checked={form.cvVariant === 'full'} onChange={() => form.setCvVariant('full')} />
                {t('propose.variantFull')}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {t('propose.variantRedacted')}
            </div>
          </div>

          {/* 4. Bericht — subject + the shared rich-text body, prefilled from the
              tenant's proposal templates ({kandidaat} {vacature} {klant} {contact}
              {recruiter} tokens filled in by useProposeForm). */}
          <div>
            <div style={sectionTitle}>{t('propose.message')}</div>
            <label htmlFor="propose-subject" style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('propose.subject')}</label>
            <input id="propose-subject" value={form.subject} onChange={e => form.setSubject(e.target.value)}
              style={{ ...inputBase, marginBottom: 8 }} />
            <RichTextEditor value={form.body} onChange={form.setBody}
              expanded={bodyExpanded} onToggleExpand={() => setBodyExpanded(v => !v)} />
          </div>

          {/* 5. AVG-bevestiging — required tick; the primary action stays disabled
              without it (see disabledText above). */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text)' }}>
            <input type="checkbox" checked={form.consentConfirmed} onChange={e => form.setConsentConfirmed(e.target.checked)}
              style={{ marginTop: 2 }} />
            {t('propose.consent', { klant: a.client })}
          </label>
        </div>

        {/* The honest line — Koios prepares the CV + message, it does not send them
            itself. Never a Verzenden button. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 16, padding: '8px 10px', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)',
          background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {t('propose.notSentYet')}
        </div>

        {/* V-appdetail-5: on success, hand over the recorded proposal's own share
            link right here — a copy button, never the raw URL in a log/toast (§8). */}
        {form.shareUrl && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px',
            borderRadius: 8, fontSize: 11, color: 'var(--color-success)',
            background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
            <span style={{ flex: 1 }}>{t('propose.recorded')}</span>
            <button type="button" onClick={form.copyShareLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', fontSize: 11,
                borderRadius: 6, border: '1px solid var(--color-success)', background: 'transparent',
                color: 'var(--color-success)', cursor: 'pointer' }}>
              {form.shareLinkCopied ? <Check size={11} /> : <Copy size={11} />}
              {form.shareLinkCopied ? t('propose.copied') : t('propose.copyLink')}
            </button>
          </div>
        )}

        {disabledText && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{disabledText}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          {/* BUTTON-SOFT-TINT-1 (Danny 05-08): was a white/transparent outline
              button — now the house soft-tint recipe (§4, mirrors DrawerAddButton/
              QuickViewToggle). */}
          <button onClick={form.copyMessage} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500,
            border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)', borderRadius: 8,
            background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary-text)', cursor: 'pointer' }}>
            {form.copied ? t('propose.copied') : t('propose.copyMessage')}
          </button>
          <Button variant="primary" onClick={handleSubmit} disabled={!!form.disabledReason || form.submitting}>
            {t('propose.submit')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
