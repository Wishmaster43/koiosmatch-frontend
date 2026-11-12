/**
 * ProposeCandidateModal — the "propose this candidate to the customer" flow:
 * downloads the house-style CV, drafts a message from the tenant's templates,
 * and logs it as an application note. See the fuller docblock below, right
 * above the component, for the full behaviour and its AXIS-MATRIX guards.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Info, Send } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { useActionRulePreflight, ActionRuleBanner, ActionRuleDialog } from '@/components/actionrules'
import type { ActionRuleDecision } from '@/components/actionrules'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ReasonModalHeader from '@/components/ui/ReasonModalHeader'
import ModalFooter from '@/components/ui/ModalFooter'
import { Caption, sectionTitleStyle } from '@/components/ui/typography'
import { useProposeForm } from './useProposeForm'
import ProposeFieldRows, { ProposeSubjectRow } from './ProposeFieldRows'
import type { ApplicationDetail } from '@/types/application'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import Toggle from '@/components/ui/Toggle'

// r6: the identity comes from the typography module; only the layout margin is local.
const sectionTitle = { ...sectionTitleStyle, fontSize: 12, marginBottom: 6 } as const

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
  // CLAIM-1: switches the drawer to the Application tab (where ProposalsBlock
  // renders) BEFORE closing — the host (ApplicationDrawer) owns tab navigation,
  // so this is a prop, not a local close. Omitted hosts fall back to a plain
  // close (§3: honest reach, never a dead "view" button).
  onOpenExisting?: () => void
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
export default function ProposeCandidateModal({ application: a, onClose, onOpenExisting }: Props) {
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

  // Human-readable reason the primary action is disabled (§3 — never a bare
  // greyed-out button with no explanation).
  const disabledText = form.disabledReason === 'loading' ? t('propose.loading')
    : form.disabledReason === 'noCandidate' ? t('candidateDetail.error')
    : form.disabledReason === 'noContact' ? t('propose.noContacts')
    : form.disabledReason === 'pickRecipient' ? t('propose.pickRecipient')
    : form.disabledReason === 'noConsent' ? t('propose.consentRequired')
    : null

  // V-appdetail-5: on success the modal stays open long enough to hand over the
  // share link (never auto-closes into it) — the recruiter closes it themselves
  // once they've copied/opened it, mirroring ProposalsBlock's own affordance.
  const handleSubmit = async () => {
    await form.submit()
  }

  // CLAIM-1: "Bekijk bestaand voorstel" switches the drawer to the Application
  // tab (ProposalsBlock renders there, CvSubTab) before closing — propose can
  // open from any drawer tab (header trigger), and that tab only renders the
  // block on 'application', so a bare close from elsewhere would just close
  // the modal onto whatever tab was already showing (§3, no fake affordance).
  const openExisting = () => { if (onOpenExisting) onOpenExisting(); else onClose() }

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onClose} ariaLabel={t('propose.title')}
      persistKey="application-propose" width={560} maxWidth="92vw"
      scrollBody={false}
      header={<ReasonModalHeader icon={Send} iconBg="var(--color-primary-bg)" iconColor="var(--color-primary-text)" title={t('propose.title')} />}>
      {/* Scroll area with the form; the shared footer below stays pinned. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
        {decision?.effect === 'warn' && <div style={{ marginBottom: 12 }}><ActionRuleBanner decision={decision} /></div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Recipient + sender: label-left rows on the shared form kit. */}
          <ProposeFieldRows form={form} />

          {/* 2. Documents: the house-style CV is always included (not unselectable:
              without it this isn't a proposal); no motivation letter travels (5f = C). */}
          <div>
            <div style={sectionTitle}>{t('propose.documents')}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
              <input type="checkbox" checked disabled aria-label={t('propose.cvHouseStyle')} />
              {t('propose.cvHouseStyle')}
            </label>
          </div>

          {/* 3. CV variant — the AVG (Dutch GDPR) control: which fields the proposal variant hides
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
            <Caption as="div" style={{ display: 'flex', gap: 5, marginTop: 6 }}>
              <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {t('propose.variantRedacted')}
            </Caption>
          </div>

          {/* 4. Message — subject + the shared rich-text body, prefilled from the
              tenant's proposal templates ({kandidaat} {vacature} {klant} {contact}
              {recruiter} tokens filled in by useProposeForm). */}
          <div>
            <div style={sectionTitle}>{t('propose.message')}</div>
            <div style={{ marginBottom: 8 }}><ProposeSubjectRow form={form} /></div>
            <RichTextEditor value={form.body} onChange={form.setBody}
              expanded={bodyExpanded} onToggleExpand={() => setBodyExpanded(v => !v)} />
          </div>

          {/* K-248 PROPOSE-SEND-1: send-it-yourself toggle — Koios sends the mail via
              the tenant/sender mailbox by default; switching it off records the
              proposal + share link only, so the recruiter shares it themselves. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={sectionTitle}>{t('propose.sendEmail')}</div>
            <Toggle checked={form.sendEmail} onChange={form.setSendEmail} ariaLabel={t('propose.sendEmail')} />
          </div>

          {/* 5. AVG (GDPR) confirmation — required tick; the primary action stays disabled
              without it (see disabledText above). */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text)' }}>
            <input type="checkbox" checked={form.consentConfirmed} onChange={e => form.setConsentConfirmed(e.target.checked)}
              style={{ marginTop: 2 }} />
            {t('propose.consent', { klant: a.client })}
          </label>
        </div>

        {/* The honest line — with the send toggle on, Koios sends the mail itself
            (K-248); off, it only records. Shared CalloutBox (§4 feedback atom) —
            the hand-rolled tint banner here double-prefixed tintBorder into
            invalid CSS and dodged the lint via a token const (Opus-controle). */}
        <div style={{ marginTop: 16 }}>
          <CalloutBox variant="info">{form.sendEmail ? t('propose.sentByKoiosInfo') : t('propose.notSentYet')}</CalloutBox>
        </div>

        {/* V-appdetail-5: on success, hand over the recorded proposal's own share
            link right here — a copy button, never the raw URL in a log/toast (§8). */}
        {form.shareUrl && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px',
            borderRadius: 8, fontSize: 11, color: 'var(--color-on-success-bg)',
            background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
            <span style={{ flex: 1 }}>{t('propose.recorded')}</span>
            {/* PRIMAIR-VLAK-1 (19-08): a copy action is secondary, not a completion —
                `variant="success"` is reserved for positive-completion actions
                (Button.tsx), and this file's own copyMessage button below already
                uses secondary for the same kind of affordance. */}
            <Button variant="secondary" size="sm" onClick={form.copyShareLink}>
              {form.shareLinkCopied ? <Check size={11} /> : <Copy size={11} />}
              {form.shareLinkCopied ? t('propose.copied') : t('propose.copyLink')}
            </Button>
          </div>
        )}

        {/* CLAIM-1: a 409 duplicate-propose conflict — the modal stays open,
            the callout names which window collided, with a force-resend and
            a way back to the existing proposal. */}
        {form.conflict && (
          <div style={{ marginTop: 10 }}>
            <CalloutBox variant="warning">
              {form.conflict.code === 'proposal_in_flight'
                ? t('propose.conflict.proposal_in_flight')
                : t('propose.conflict.proposal_recently_sent')}
            </CalloutBox>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button variant="ghost" size="sm" onClick={openExisting}>
                {t('propose.conflict.openExisting')}
              </Button>
              <Button variant="secondary" size="sm" onClick={form.forceSend} disabled={form.submitting}>
                {t('propose.conflict.forceSend')}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* The disabled reason keeps its own pinned line above the footer (§3 never a bare greyed
          button): inside the footer row the three buttons leave it no width (lens 12-11). */}
      {disabledText && <Caption as="div" style={{ padding: '0 24px 8px' }}>{disabledText}</Caption>}
      {/* Shared footer: the copy-message affordance sits left (PRIMAIR-VLAK-1: secondary, not a completion). */}
      <ModalFooter onCancel={onClose} onSubmit={handleSubmit} cancelLabel={t('common:cancel')}
        submitLabel={t('propose.submit')} disabled={!!form.disabledReason} busy={form.submitting}
        leftSlot={(
          <Button variant="secondary" onClick={form.copyMessage}>
            {form.copied ? t('propose.copied') : t('propose.copyMessage')}
          </Button>
        )} />
    </FloatingPanel>
  )
}
