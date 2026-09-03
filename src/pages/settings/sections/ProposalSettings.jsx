/**
 * ProposalSettings — Settings → Sollicitaties → Voorstellen. Configures the
 * subject/body template a recruiter sends when proposing a candidate to a
 * customer contact, whether recording a proposal auto-advances the funnel phase,
 * and which CV variant (redacted vs. full) is offered by default. Koios does not
 * send anything itself yet (PROPOSE-SHARE-LINK-1 open) — the notice above says so.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Save } from 'lucide-react'
import { useAllSettings, getJsonSetting, saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { useUsers } from '@/lib/queries'
import { useAuth } from '@/context/AuthContext'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SegmentedControl from '@/components/ui/SegmentedControl'
import CreatableSelect from '@/components/ui/CreatableSelect'
import CalloutBox from '@/components/ui/CalloutBox'
import { Toggle } from '../components/SettingsKit'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SaveButton from '@/components/ui/SaveButton'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { PageTitle, Mono, BodyText } from '@/components/ui/typography'
import { tintBg, tintBorder } from '@/lib/tint'

// VOORSTEL-AFZENDER-FE-1: the tenant-wide default sender — a bare uuid string
// saved through the generic settings passthrough, never inside the JSON
// 'application_proposal' group (a separate top-level settings key by contract).
const SENDER_SETTING_KEY = 'proposal_default_sender_user_id'

// The tenant-setting key: one JSON blob holding the whole proposal configuration
// (shared contract with the sibling "propose candidate" modal — MODAL agent reads
// the same key via getJsonSetting).
const SETTINGS_KEY = 'application_proposal'

// Tokens available in subject/body templates — literal template syntax, not prose,
// so it is shown as-is rather than run through t().
// English token set since CMBE 3a0f6986 (renderer still aliases the old Dutch spellings).
const TOKENS = ['{candidate}', '{vacancy}', '{customer}', '{contact}', '{recruiter}', '{agency}', '{link}']

const DEFAULTS = {
  subject_template: '',
  body_template: '',
  sets_phase: false,
  default_cv_variant: 'proposal',
}

// Settings screen for the proposal template plus sets_phase/default CV variant, backed by one JSON tenant setting.
export default function ProposalSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const values = useAllSettings()
  const stored = getJsonSetting(values, SETTINGS_KEY, {})
  const persisted = { ...DEFAULTS, ...stored }
  const { data: users, isSuccess, isPlaceholderData } = useUsers()
  // Measured (query-core 5.101): placeholderData forces status 'success' while the GET is
  // still pending, so isSuccess alone is true throughout the load window — the list only
  // counts as loaded once it is no longer the placeholder.
  const usersLoaded = isSuccess && !isPlaceholderData
  const senderOptions = (users ?? []).map(u => ({ value: u.id, label: u.name }))

  // VOORSTEL-AFZENDER-FE-1: the stored default sender, '' meaning "the proposer".
  const defaultSenderId = typeof values[SENDER_SETTING_KEY] === 'string' ? values[SENDER_SETTING_KEY] : ''
  // Only flags stale once the users list has REALLY loaded (see usersLoaded above):
  // during the placeholder window and on error a real uuid must never read as "no such user".
  const senderStale = Boolean(defaultSenderId) && usersLoaded && !users.some(u => u.id === defaultSenderId)

  // Commits the default sender immediately (small, discrete pick — no draft buffer),
  // mirroring the sets_phase/variant toggles below.
  const chooseSender = async (id) => {
    try {
      await saveSettingsKeys({ [SENDER_SETTING_KEY]: id || '' })
      invalidateAllSettingsCache()
    } catch (err) {
      notifyError(extractApiError(err, t('proposal.saveFailed')))
    }
  }

  // Local buffer for the free-text template fields; committed via an explicit save
  // so typing/rich-text edits never spam the API (house pattern, NumberingSettings).
  const [subject, setSubject] = useState(persisted.subject_template)
  const [body, setBody] = useState(persisted.body_template)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  // Persists the buffered subject/body template only on explicit save, then flashes the shared saved-state for 2s.
  const saveTemplate = async () => {
    setTemplateSaving(true)
    try {
      await saveSettingsKeys({ [SETTINGS_KEY]: { ...persisted, subject_template: subject, body_template: body } })
      invalidateAllSettingsCache()
      setTemplateSaved(true)
      setTimeout(() => setTemplateSaved(false), 2000)
    } catch {
      notifyError(t('proposal.saveFailed'))
    } finally {
      setTemplateSaving(false)
    }
  }

  // Toggle/radio choices commit immediately (house pattern for single switches —
  // mirrors CareerSiteSettings): small, discrete picks, no keystroke spam risk.
  const toggleSetsPhase = () => {
    saveSettingsKeys({ [SETTINGS_KEY]: { ...persisted, sets_phase: !persisted.sets_phase } })
      .then(invalidateAllSettingsCache)
      .catch(() => notifyError(t('proposal.saveFailed')))
  }

  // Commits the default CV variant immediately (no draft buffer), mirroring the sets_phase toggle above.
  const chooseVariant = (variant) => {
    if (variant === persisted.default_cv_variant) return
    saveSettingsKeys({ [SETTINGS_KEY]: { ...persisted, default_cv_variant: variant } })
      .then(invalidateAllSettingsCache)
      .catch(() => notifyError(t('proposal.saveFailed')))
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }
  const labelStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }
  const hintStyle = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }
  // Canon field style (G33/fieldMetrics) — already matched it exactly, now shared.
  const inputStyle = fieldInputStyle

  return (
    <div style={{ maxWidth: 720 }}>
      <PageTitle>{t('proposal.title')}</PageTitle>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>{t('proposal.subtitle')}</p>

      {/* Honest notice — no fake affordance: Koios never sends this on its own yet. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, fontSize: 12,
        color: 'var(--color-info)', background: tintBg('var(--color-info)'),
        border: tintBorder('var(--color-info)'), marginBottom: 16 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{t('proposal.notSentYet')}</span>
      </div>

      {/* Subject/body template */}
      <div style={cardStyle}>
        <label style={labelStyle} htmlFor="proposal-subject">{t('proposal.subjectLabel')}</label>
        <input id="proposal-subject" value={subject} onChange={e => setSubject(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }} />

        <label style={labelStyle}>{t('proposal.bodyLabel')}</label>
        {/* House rule: every multi-line free-text field is the shared rich-text editor.
            This is a reusable message TEMPLATE (token placeholders, no real recipient
            yet), not a conversation, so it never opts into "Actiepunten" — it rides
            RichTextAssistBar's own improve+summarize-only default
            (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field override needed. */}
        <RichTextEditor value={body} onChange={setBody} minHeight={180} resizable />

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('proposal.tokensTitle')}</div>
          <p style={hintStyle}>{t('proposal.tokensHint')}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TOKENS.map(token => (
              // necessity: deliberately keeps the `--color-primary-bg` fallback chain
              // (a themed token first, color-mix only as its fallback) — not the plain
              // tintBg() recipe, so left as a literal rather than swapped.
              <Mono key={token} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                color: 'var(--color-primary-text)', background: 'var(--color-primary-bg, color-mix(in srgb, var(--color-primary) 10%, transparent))',
                border: tintBorder('var(--color-primary)') }}>
                {token}
              </Mono>
            ))}
          </div>
        </div>

        {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
        <SaveButton saved={templateSaved} onClick={saveTemplate} disabled={templateSaving} style={{ marginTop: 14 }}>
          <Save size={12} />
          {templateSaved ? t('proposal.saved') : templateSaving ? t('common.saving') : t('common.save')}
        </SaveButton>
      </div>

      {/* Phase automation */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={!!persisted.sets_phase} onChange={toggleSetsPhase} ariaLabel={t('proposal.setsPhaseLabel')} />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('proposal.setsPhaseLabel')}</span>
        </div>
        <p style={{ ...hintStyle, marginTop: 6, marginBottom: 0 }}>{t('proposal.setsPhaseHint')}</p>
      </div>

      {/* Default CV variant */}
      <div style={cardStyle}>
        <label style={labelStyle}>{t('proposal.defaultVariantLabel')}</label>
        {/* Replaces bare radio inputs — shared SegmentedControl, identical values/onChange */}
        <SegmentedControl
          ariaLabel={t('proposal.defaultVariantLabel')}
          value={persisted.default_cv_variant}
          onChange={chooseVariant}
          options={[
            { value: 'proposal', label: t('proposal.variantProposal') },
            { value: 'full', label: t('proposal.variantFull') },
          ]}
        />
      </div>

      {/* Default sender — VOORSTEL-AFZENDER-FE-1: the tenant user proposals go out
          in the name of by default, unless a recruiter picks someone else. */}
      <div style={cardStyle}>
        <label style={labelStyle}>{t('proposal.defaultSenderTitle')}</label>
        <p style={hintStyle}>{t('proposal.defaultSenderSubtitle')}</p>
        {canEdit ? (
          <CreatableSelect allowCreate={false} value={senderOptions.some(o => o.value === defaultSenderId) ? defaultSenderId : null}
            onChange={chooseSender} options={senderOptions}
            placeholder={t('proposal.defaultSenderSelf')}
            clearable clearLabel={t('proposal.defaultSenderTitle')} />
        ) : (
          <BodyText>{senderOptions.find(o => o.value === defaultSenderId)?.label ?? t('proposal.defaultSenderSelf')}</BodyText>
        )}
        {senderStale && (
          <div style={{ marginTop: 8 }}>
            <CalloutBox variant="warning">{t('proposal.defaultSenderStale')}</CalloutBox>
          </div>
        )}
      </div>
    </div>
  )
}
