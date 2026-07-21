/**
 * VacancyGenerationProfileEditor — the form fields for one generation profile
 * (matcher + content rules), shared by the create card and every expand-card
 * edit in VacancyGenerationProfilesList. Pure presentational component: it owns
 * no persistence, only a controlled `draft` + `onChange(patch)` — the parent
 * list decides POST vs PUT and when to save.
 *
 * Matcher fields deliberately use the SAME shape the app already stores data in
 * (plain name strings for contract form / function / industry — mirrors
 * useContractTypes/useFunctions/useIndustries, none of which expose ids/slugs —
 * and location ids from useLocations). This deviates from the task's proposed
 * `contract_type_slugs[]` / `function_group_ids[]` / `industry_ids[]` contract;
 * see the VacancyGenerationSettings hand-off note for backend-Claude.
 */
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { useLocations } from '@/lib/useLocations'
import { useContractTypes } from '@/lib/useContractTypes'
import { useFunctions } from '@/lib/useFunctions'
import { useIndustries } from '@/lib/useIndustries'
import { useLanguageLookups } from '@/lib/useLanguageLookups'

// Tone-of-voice and length are fixed prompt-engine parameters (like the custom-field
// TYPE select), not tenant business data — a small hardcoded enum is appropriate here,
// unlike location/contract-form/function/industry which ARE tenant lookups (§3B).
const TONES = ['neutral', 'professional', 'friendly', 'enthusiastic', 'formal']
const LENGTHS = ['short', 'medium', 'long']

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const inputStyle = { padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const hintStyle = { fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }

// Toggle a value's membership in an array (add if absent, remove if present).
const toggle = (arr, value) => arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]

// One labelled multiselect row for the matcher section — same shape used 4x below.
function MatcherField({ label, options, selected, onToggle, emptyText }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <ChipMultiSelect options={options} selected={selected} onToggle={onToggle} emptyText={emptyText} />
    </div>
  )
}

export default function VacancyGenerationProfileEditor({ draft, onChange, contentBlocks = [] }) {
  const { t } = useTranslation('settings')
  const [wordDraft, setWordDraft] = useState('')

  // Tenant lookups feeding the matcher chips — never a hardcoded option list (§3B).
  const locations = useLocations()
  const { types: contractTypes } = useContractTypes()
  const { functions } = useFunctions()
  const { industries } = useIndustries()
  const { languages } = useLanguageLookups()

  const setMatcher = (key, value) => onChange({ matcher: { ...draft.matcher, [key]: value } })
  const setContent = (key, value) => onChange({ content: { ...draft.content, [key]: value } })

  // Add the typed word to the forbidden-words list (mirrors the API-key IP whitelist
  // chip-adder: type, Enter or click Add, dedupe, clear the input).
  const addWord = () => {
    const w = wordDraft.trim()
    if (!w || draft.content.forbidden_words.includes(w)) return
    setContent('forbidden_words', [...draft.content.forbidden_words, w])
    setWordDraft('')
  }
  const removeWord = (w) => setContent('forbidden_words', draft.content.forbidden_words.filter(x => x !== w))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Identity — name, standard priority + is_default live in the parent row. */}
      <div>
        <label style={labelStyle}>{t('vacancyGenerationSettings.nameLabel')} *</label>
        <input value={draft.name} onChange={e => onChange({ name: e.target.value })}
          placeholder={t('vacancyGenerationSettings.namePlaceholder')} style={inputStyle} />
      </div>
      <div style={{ maxWidth: 160 }}>
        <label style={labelStyle}>{t('vacancyGenerationSettings.priorityLabel')}</label>
        <input type="number" min={1} value={draft.priority}
          onChange={e => onChange({ priority: Number(e.target.value) || 1 })} style={inputStyle} />
        <p style={hintStyle}>{t('vacancyGenerationSettings.priorityHint')}</p>
      </div>

      {/* Matcher — which vacancy characteristics this profile applies to. An empty
          field means "matches any value" (the future resolver's default). */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{t('vacancyGenerationSettings.matcherTitle')}</div>
        <p style={{ ...hintStyle, marginBottom: 10 }}>{t('vacancyGenerationSettings.matcherHint')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MatcherField label={t('vacancyGenerationSettings.matcherLocations')}
            options={locations.map(l => ({ value: String(l.value), label: l.label }))}
            selected={draft.matcher.location_ids} onToggle={v => setMatcher('location_ids', toggle(draft.matcher.location_ids, v))}
            emptyText={t('vacancyGenerationSettings.matcherEmpty')} />
          <MatcherField label={t('vacancyGenerationSettings.matcherContractTypes')}
            options={contractTypes.map(name => ({ value: name, label: name }))}
            selected={draft.matcher.contract_types} onToggle={v => setMatcher('contract_types', toggle(draft.matcher.contract_types, v))}
            emptyText={t('vacancyGenerationSettings.matcherEmpty')} />
          <MatcherField label={t('vacancyGenerationSettings.matcherFunctions')}
            options={functions.map(name => ({ value: name, label: name }))}
            selected={draft.matcher.function_titles} onToggle={v => setMatcher('function_titles', toggle(draft.matcher.function_titles, v))}
            emptyText={t('vacancyGenerationSettings.matcherEmpty')} />
          <MatcherField label={t('vacancyGenerationSettings.matcherIndustries')}
            options={industries.map(name => ({ value: name, label: name }))}
            selected={draft.matcher.industries} onToggle={v => setMatcher('industries', toggle(draft.matcher.industries, v))}
            emptyText={t('vacancyGenerationSettings.matcherEmpty')} />
        </div>
      </div>

      {/* Content — the template + brand rules the generator (fase 1b) will apply. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('vacancyGenerationSettings.contentTitle')}</div>

        <div>
          <label style={labelStyle}>{t('vacancyGenerationSettings.templateLabel')}</label>
          <RichTextEditor value={draft.content.template} onChange={v => setContent('template', v)} minHeight={120} />
          <p style={hintStyle}>{t('vacancyGenerationSettings.templateHint')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>{t('vacancyGenerationSettings.toneLabel')}</label>
            <select value={draft.content.tone_of_voice} onChange={e => setContent('tone_of_voice', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {TONES.map(v => <option key={v} value={v}>{t(`vacancyGenerationSettings.tone.${v}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('vacancyGenerationSettings.lengthLabel')}</label>
            <select value={draft.content.length} onChange={e => setContent('length', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {LENGTHS.map(v => <option key={v} value={v}>{t(`vacancyGenerationSettings.length.${v}`)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t('vacancyGenerationSettings.languageLabel')}</label>
            <select value={draft.content.language} onChange={e => setContent('language', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">{t('vacancyGenerationSettings.languagePlaceholder')}</option>
              {languages.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>

        {/* Emoji toggle — checkbox + label + description, mirrors StatusListEditor's flagField. */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.content.allow_emoji}
            onChange={e => setContent('allow_emoji', e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t('vacancyGenerationSettings.emojiLabel')}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{t('vacancyGenerationSettings.emojiHint')}</span>
          </span>
        </label>

        <div>
          <label style={labelStyle}>{t('vacancyGenerationSettings.brandLabel')}</label>
          <RichTextEditor value={draft.content.brand_instructions} onChange={v => setContent('brand_instructions', v)} minHeight={80} />
        </div>

        {/* Forbidden words — free-text chip adder (mirrors the API-key IP whitelist). */}
        <div>
          <label style={labelStyle}>{t('vacancyGenerationSettings.forbiddenLabel')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: draft.content.forbidden_words.length ? 8 : 0 }}>
            {draft.content.forbidden_words.map(w => (
              <span key={w} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)' }}>
                {w}
                <button onClick={() => removeWord(w)} aria-label={t('common.remove')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 320 }}>
            <input value={wordDraft} onChange={e => setWordDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord() } }}
              placeholder={t('vacancyGenerationSettings.forbiddenPlaceholder')} style={inputStyle} />
            <button onClick={addWord} disabled={!wordDraft.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: wordDraft.trim() ? 'pointer' : 'not-allowed', opacity: wordDraft.trim() ? 1 : 0.5, color: 'var(--text)' }}>
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Reusable blocks this profile pulls in — fed by the sibling Herbruikbare-blokken tab. */}
        <div>
          <label style={labelStyle}>{t('vacancyGenerationSettings.blocksLabel')}</label>
          <ChipMultiSelect
            options={contentBlocks.map(b => ({ value: b.id, label: `${b.name} (${t(`vacancyContentBlocksSettings.kind.${b.kind}`)})` }))}
            selected={draft.content.content_block_ids}
            onToggle={v => setContent('content_block_ids', toggle(draft.content.content_block_ids, v))}
            emptyText={t('vacancyGenerationSettings.blocksEmpty')} />
          <p style={hintStyle}>{t('vacancyGenerationSettings.blocksHint')}</p>
        </div>
      </div>
    </div>
  )
}
