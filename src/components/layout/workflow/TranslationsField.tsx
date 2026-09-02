/**
 * TranslationsField — the workflow config panel's "Vertalingen" tab editor.
 * Three Danny instructions (02-09, verbatim):
 * (1) "iemand moet in de module ook een extra taal kunnen toevoegen. Is de
 *     voorkeurstaal niet beschikbaar in de workflow module wordt dan de
 *     [taal] van bedrijf."
 * (2) "Vertaling is alleen als het vrij tekst module is. Bij template kan
 *     dit niet."
 * (3) "taal kunnen we toch alleen bedrijfstaal laten zien en met plusje kan
 *     je taal toevoegen. Net zoals kandidaat drilldown doen talen: een extra
 *     taal alleen dan taal toevoegen met tekst."
 * So this tab shows a read-only "Bedrijfstaal" reference card (the main-tab
 * text(s), for context), then one row per language the user ADDED — nothing
 * is pre-rendered — plus an add affordance. Writes into `config.translations`
 * per the CMBE3 contract: `{ "<code>": { text?, subject?, body? } }` — any
 * language code may be a key, and an empty per-field falls back to the
 * main-tab field (bureau language) at send time.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { WorkflowField } from '@/types/workflow'
import type { OnChange } from './fieldControls/types'
import { ExpandableTextarea } from './fields'
import { PANEL_INPUT_STYLE } from './panelInputStyle'
import { SectionTitle, Caption, BodyText, monoStyle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { languageDisplayName, ADDABLE_LANGUAGE_CODES } from '@/lib/languageNames'

// The nested value shape this field persists: language code -> sub-field -> text.
type TranslationsValue = Record<string, Record<string, string>>

// Mirrors ConfigPanel's own field-label look (10px uppercase muted) so a
// sub-field label inside a language block reads identically to the main tab.
const SUB_LABEL_STYLE = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 }

export function TranslationsField({ field, value, onChange, config }: {
  field: WorkflowField
  value?: unknown
  onChange: OnChange
  config?: Record<string, unknown>
}) {
  const { t, i18n } = useTranslation('workflows')
  const [adding, setAdding] = useState(false)
  // Cast: `translations`'s own registry field carries `languages: string[]`,
  // `fields: string[]` (sub-field keys) and `mainFields` (sub-field -> the
  // main-tab config key it mirrors), a shape distinct from the generic
  // WorkflowField.fields (string|FieldOption)[] used by the 'group' field type.
  const langField = field as unknown as { languages?: string[]; fields?: string[]; mainFields?: Record<string, string> }
  const defaultLanguages = langField.languages ?? []
  const subFields = langField.fields ?? []
  const mainFields = langField.mainFields ?? {}
  const current = (value ?? {}) as TranslationsValue

  // Shown languages: ONLY what the user added — insertion order of the value
  // map, never a pre-rendered default block (Danny 02-09, instruction 3).
  const languages = Object.keys(current)

  // Writes one sub-field for one language. An emptied field deletes only that
  // sub-key — the language ENTRY itself stays (even as `{}`), because its mere
  // presence is what shows the row in this tab (VERTALINGEN-TOEVOEGEN-1).
  const setSub = (code: string, sub: string, text: string) => {
    const next: TranslationsValue = {}
    for (const [k, v] of Object.entries(current)) next[k] = { ...v }
    const langEntry = { ...(next[code] ?? {}) }
    if (text === '') {
      delete langEntry[sub]
    } else {
      langEntry[sub] = text
    }
    next[code] = langEntry
    onChange('translations', next)
  }

  // Adds a new, initially-empty language entry.
  const addLanguage = (code: string) => {
    onChange('translations', { ...current, [code]: {} })
    setAdding(false)
  }

  // Removes a language entirely.
  const removeLanguage = (code: string) => {
    const next: TranslationsValue = {}
    for (const [k, v] of Object.entries(current)) if (k !== code) next[k] = v
    onChange('translations', next)
  }

  // Pickable codes for "add a language": registry defaults FIRST (suggested),
  // then the curated addable list sorted by display name, minus what's shown.
  const shown = new Set(languages)
  const defaultCandidates = defaultLanguages.filter(code => !shown.has(code))
  const extraCandidates = [...ADDABLE_LANGUAGE_CODES]
    .filter(code => !shown.has(code) && !defaultLanguages.includes(code))
    .sort((a, b) => languageDisplayName(a, i18n.language).localeCompare(languageDisplayName(b, i18n.language), i18n.language))
  const candidates = [...defaultCandidates, ...extraCandidates]
    .map(code => ({ value: code, label: `${languageDisplayName(code, i18n.language)} (${code.toUpperCase()})` }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Read-only reference card: the current main-tab text(s), the bureau/company language. */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
        <SectionTitle as="div">{t('translations.companyLanguage')}</SectionTitle>
        <Caption as="div">{t('translations.editOnSettings')}</Caption>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {subFields.map(sub => {
            const mainKey = mainFields[sub]
            const mainValue = mainKey ? (config?.[mainKey] as string | undefined) ?? '' : ''
            return (
              <div key={sub}>
                <label style={SUB_LABEL_STYLE}>{t(`translations.fields.${sub}`)}</label>
                {mainValue
                  ? <BodyText as="div" style={{ whiteSpace: 'pre-wrap' }}>{mainValue}</BodyText>
                  : <Caption as="div" style={{ fontStyle: 'italic' }}>{t('translations.noText')}</Caption>}
              </div>
            )
          })}
        </div>
      </div>
      {languages.length === 0 && <Caption as="div">{t('translations.empty')}</Caption>}
      {languages.map(code => {
        const languageName = languageDisplayName(code, i18n.language)
        return (
          <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SectionTitle as="div">{languageName}</SectionTitle>
                <Caption as="span" style={monoStyle}>{code.toUpperCase()}</Caption>
              </div>
              <Button variant="dangerSoft" size="sm" iconOnly onClick={() => removeLanguage(code)}
                aria-label={t('translations.removeLanguage', { language: languageName })}
                title={t('translations.removeLanguage', { language: languageName })}>
                <Trash2 size={12} />
              </Button>
            </div>
            {subFields.map(sub => {
              const subLabel = t(`translations.fields.${sub}`)
              const subValue = current[code]?.[sub] ?? ''
              return (
                <div key={sub}>
                  <label style={SUB_LABEL_STYLE}>{subLabel}</label>
                  {sub === 'subject'
                    ? <input value={subValue} onChange={e => setSub(code, sub, e.target.value)}
                        aria-label={`${languageName} ${subLabel}`} style={PANEL_INPUT_STYLE} />
                    : <ExpandableTextarea
                        field={{ key: sub, label: `${languageName} ${subLabel}` } as WorkflowField}
                        value={subValue}
                        onChange={(_key, next) => setSub(code, sub, (next as string) ?? '')} />}
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {adding
          ? <CreatableSelect allowCreate={false} value={null} placeholder={t('translations.pickLanguage')}
              options={candidates} onChange={addLanguage} />
          : <DrawerAddButton label={t('translations.addLanguage')} onClick={() => setAdding(true)} />}
        <Caption as="div">{t('translations.fallbackHint')}</Caption>
      </div>
    </div>
  )
}
