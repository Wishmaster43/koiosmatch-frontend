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
import RichTextEditor from '@/components/ui/RichTextEditor'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Toggle } from '../components/SettingsKit'
import { notifyError } from '@/lib/notify'
import SaveButton from '@/components/ui/SaveButton'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { PageTitle, Mono } from '@/components/ui/typography'

// The tenant-setting key: one JSON blob holding the whole proposal configuration
// (shared contract with the sibling "propose candidate" modal — MODAL agent reads
// the same key via getJsonSetting).
const SETTINGS_KEY = 'application_proposal'

// Tokens available in subject/body templates — literal template syntax, not prose,
// so it is shown as-is rather than run through t().
const TOKENS = ['{kandidaat}', '{vacature}', '{klant}', '{contact}', '{recruiter}']

const DEFAULTS = {
  subject_template: '',
  body_template: '',
  sets_phase: false,
  default_cv_variant: 'proposal',
}

export default function ProposalSettings() {
  const { t } = useTranslation('settings')
  const values = useAllSettings()
  const stored = getJsonSetting(values, SETTINGS_KEY, {})
  const persisted = { ...DEFAULTS, ...stored }

  // Local buffer for the free-text template fields; committed via an explicit save
  // so typing/rich-text edits never spam the API (house pattern, NumberingSettings).
  const [subject, setSubject] = useState(persisted.subject_template)
  const [body, setBody] = useState(persisted.body_template)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

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
        color: 'var(--color-info)', background: 'color-mix(in srgb, var(--color-info) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-info) 30%, transparent)', marginBottom: 16 }}>
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
              <Mono key={token} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                color: 'var(--color-primary-text)', background: 'var(--color-primary-bg, color-mix(in srgb, var(--color-primary) 10%, transparent))',
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
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
    </div>
  )
}
