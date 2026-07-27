import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Send, TriangleAlert, X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useActionRulePreflight, ActionRuleBanner, ActionRuleDialog } from '@/components/actionrules'
import type { ActionRuleDecision } from '@/components/actionrules'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { BTN_H } from '@/config/buttonMetrics'
import { useProposeForm } from './useProposeForm'
import type { ApplicationDetail } from '@/types/application'

// Overlay/panel frame mirrors RejectionModal (§ house rule) — a touch wider
// (560) to hold the recipient picker, variant choice and message composer.
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
  width: 560, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 20,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '88vh', overflowY: 'auto',
}
const sectionTitle = { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 } as const
const muted = { fontSize: 11, color: 'var(--text-muted)' } as const
const inputBase = { width: '100%', boxSizing: 'border-box' as const, padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none' }

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
 * funnel-phase move). Koios does NOT send anything itself yet — the honest line
 * above the footer says so, and there is deliberately no "Verzenden" button.
 */
export default function ProposeCandidateModal({ application: a, onClose }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const form = useProposeForm(a)

  // Guard both axes this action touches — candidate.propose (sharing a health-
  // data record) and customer.propose (sharing it with this specific customer).
  const { decision: candidateDecision } = useActionRulePreflight('candidate.propose', { candidateId: String(a.candidateId ?? '') })
  const { decision: customerDecision } = useActionRulePreflight('customer.propose', { customerId: String(a.customerId ?? '') })
  const decision = strictest(candidateDecision, customerDecision)

  // A block outcome never opens the propose form — only the server's own text.
  if (decision?.effect === 'block') {
    return <ActionRuleDialog open decision={decision} onConfirm={onClose} onCancel={onClose} />
  }

  const contactOptions = form.contacts.map(c => ({ value: c.id, label: c.email ? `${c.name} — ${c.email}` : c.name }))

  // Human-readable reason the primary action is disabled (§3 — never a bare
  // greyed-out button with no explanation).
  const disabledText = form.disabledReason === 'loading' ? t('propose.loading')
    : form.disabledReason === 'noCandidate' ? t('candidateDetail.error')
    : form.disabledReason === 'noContact' ? t('propose.noContacts')
    : form.disabledReason === 'noConsent' ? t('propose.consentRequired')
    : null

  const handleSubmit = async () => {
    const ok = await form.submit()
    if (ok) onClose()
  }

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('propose.title')} tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}><Send size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('propose.title')}</span>
          <button onClick={onClose} aria-label={t('common:close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

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
            <RichTextEditor value={form.body} onChange={form.setBody} />
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
            (PROPOSE-SHARE-LINK-1 is still open on the backend). Never a Verzenden button. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 16, padding: '8px 10px', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)',
          background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {t('propose.notSentYet')}
        </div>

        {disabledText && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{disabledText}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:cancel')}
          </button>
          <button onClick={form.copyMessage} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500,
            border: '1px solid var(--color-primary)', borderRadius: 8, background: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
            {form.copied ? t('propose.copied') : t('propose.copyMessage')}
          </button>
          <button onClick={handleSubmit} disabled={!!form.disabledReason || form.submitting}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff',
              cursor: (form.disabledReason || form.submitting) ? 'not-allowed' : 'pointer',
              opacity: (form.disabledReason || form.submitting) ? 0.6 : 1 }}>
            {t('propose.submit')}
          </button>
        </div>
      </div>
    </>
  )
}
