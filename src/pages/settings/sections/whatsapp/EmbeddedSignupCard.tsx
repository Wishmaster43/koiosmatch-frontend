/**
 * EmbeddedSignupCard — the coexistence koppel-WIZARD on the WhatsApp settings
 * connection tab (WHATSAPP-COEXIST-PREP-1; Danny 23-08, translated: "also add
 * the wizard to settings for WhatsApp" — verbatim: "bij WhatsApp ook de
 * wizard toevoegen bij instellingen"). Three honest states:
 *  - not-ready: the platform's Meta app is not configured/approved yet — the
 *    card explains WHAT this will do and that it is waiting on the Meta
 *    process; no dead buttons (§3).
 *  - ready: one primary button starts Meta's popup flow (Login for Business →
 *    coexistence onboarding); the steps render as a compact numbered list so
 *    the user knows the popup + in-app confirmation are coming.
 *  - linked: success state with the optional chat-history sync (24h window).
 * The BYO-token form below stays the second, manual path — this card never
 * replaces it.
 */
import { useTranslation } from 'react-i18next'
import { MessageCircle, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import { SectionTitle, BodyText, Caption } from '@/components/ui/typography'
import { useEmbeddedSignup } from './useEmbeddedSignup'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' } as const

// See the file's top doc above for the three honest states (not-ready/ready/linked) this card renders.
export default function EmbeddedSignupCard({ onLinked, canManage }: { onLinked?: () => void; canManage: boolean }) {
  const { t } = useTranslation('settings')
  const es = useEmbeddedSignup(onLinked)

  // Config fetch failed outright — the manual token path below still works,
  // so this card reports its own state and stays out of the way.
  if (es.phase === 'config-error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 6 }}>{t('whatsapp.embedded.title')}</SectionTitle>
        <Caption as="div">{t('whatsapp.embedded.configError')}</Caption>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <MessageCircle size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} aria-hidden="true" />
        <SectionTitle style={{ marginBottom: 0 }}>{t('whatsapp.embedded.title')}</SectionTitle>
      </div>
      <BodyText style={{ color: 'var(--text-muted)', marginBottom: 10 }}>{t('whatsapp.embedded.subtitle')}</BodyText>

      {es.phase === 'config-loading' && (
        <div role="status">
          <Caption as="div" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Spinner size={13} /> {t('common.loadingShort')}
          </Caption>
        </div>
      )}

      {/* Honest waiting state: the platform's Meta app/approval is step 0 and
          lives outside this product — no button until ready (§3). */}
      {es.phase === 'not-ready' && (
        <CalloutBox variant="warning">{t('whatsapp.embedded.notReady')}</CalloutBox>
      )}

      {(es.phase === 'idle' || es.phase === 'authorizing' || es.phase === 'exchanging' || es.phase === 'error') && (
        <>
          {/* The three steps the user is about to walk through — popup, in-app
              confirm, done — so the Meta popup never feels like a hijack. */}
          <ol style={{ margin: '0 0 12px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li><BodyText as="span">{t('whatsapp.embedded.step1')}</BodyText></li>
            <li><BodyText as="span">{t('whatsapp.embedded.step2')}</BodyText></li>
            <li><BodyText as="span">{t('whatsapp.embedded.step3')}</BodyText></li>
          </ol>
          {es.phase === 'error' && es.errorKey && (
            <div style={{ marginBottom: 10 }}>
              <CalloutBox variant="danger">{t(`whatsapp.embedded.${es.errorKey}`)}</CalloutBox>
            </div>
          )}
          <Button variant="primary" size="sm" onClick={es.start}
            disabled={!canManage || es.phase === 'authorizing' || es.phase === 'exchanging'}
            title={canManage ? undefined : t('whatsapp.embedded.noRights')}>
            {(es.phase === 'authorizing' || es.phase === 'exchanging') ? <Spinner size={13} /> : <MessageCircle size={13} aria-hidden="true" />}
            {es.phase === 'exchanging' ? t('whatsapp.embedded.exchanging') : t('whatsapp.embedded.start')}
          </Button>
        </>
      )}

      {es.phase === 'linked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CalloutBox variant="success">{t('whatsapp.embedded.linked', { waba: es.linked?.wabaId ?? '' })}</CalloutBox>
          {/* History sync is only real WITH a phone number id from the flow —
              without one the offer would be a fake affordance. */}
          {es.linked?.phoneNumberId && es.syncState !== 'done' && (
            <div>
              <Button variant="secondary" size="sm" onClick={es.startHistorySync} disabled={es.syncState === 'busy'}>
                {es.syncState === 'busy' ? <Spinner size={13} /> : null}
                {t('whatsapp.embedded.syncStart')}
              </Button>
              {es.syncState === 'failed' && (
                <Caption as="div" style={{ color: 'var(--color-danger-text)', marginTop: 6 }}>{t('whatsapp.embedded.syncFailed')}</Caption>
              )}
            </div>
          )}
          {es.syncState === 'done' && (
            <Caption as="div" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} style={{ color: 'var(--color-success-text)' }} aria-hidden="true" />
              {t('whatsapp.embedded.syncDone', {
                history: es.syncResult?.history_requested ? t('whatsapp.embedded.syncYes') : t('whatsapp.embedded.syncNo'),
                contacts: es.syncResult?.contacts_requested ? t('whatsapp.embedded.syncYes') : t('whatsapp.embedded.syncNo'),
              })}
            </Caption>
          )}
        </div>
      )}
    </div>
  )
}
