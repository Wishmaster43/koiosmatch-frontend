/**
 * TranslationsField — the workflow config panel's "Vertalingen" tab editor
 * (Danny 02-09, verbatim: "vertaling moet wel in de workflow staan. Dus in de
 * module van de workflow staat dan ergens een tabje vertalingen en zie je NL
 * en En etc staan"). Renders one block per candidate-facing language with the
 * same message sub-fields the module's main tab has, writing into
 * `config.translations` per the CMBE3 contract: `{ "<code>": { text?, subject?,
 * body? } }` — an empty per-field falls back to the main-tab field (bureau
 * language) at send time, so this tab only ever holds OVERRIDES.
 */
import { useTranslation } from 'react-i18next'
import type { WorkflowField } from '@/types/workflow'
import type { OnChange } from './fieldControls/types'
import { ExpandableTextarea } from './fields'
import { PANEL_INPUT_STYLE } from './panelInputStyle'
import { SectionTitle } from '@/components/ui/typography'

// The nested value shape this field persists: language code -> sub-field -> text.
type TranslationsValue = Record<string, Record<string, string>>

// Mirrors ConfigPanel's own field-label look (10px uppercase muted) so a
// sub-field label inside a language block reads identically to the main tab.
const SUB_LABEL_STYLE = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 }

export function TranslationsField({ field, value, onChange }: {
  field: WorkflowField
  value?: unknown
  onChange: OnChange
}) {
  const { t } = useTranslation('workflows')
  // Cast: `translations`'s own registry field carries `languages: string[]` and
  // `fields: string[]` (sub-field keys), a shape distinct from the generic
  // WorkflowField.fields (string|FieldOption)[] used by the 'group' field type.
  const langField = field as unknown as { languages?: string[]; fields?: string[] }
  const languages = langField.languages ?? []
  const subFields = langField.fields ?? []
  const current = (value ?? {}) as TranslationsValue

  // Writes one sub-field for one language; an emptied value deletes that key,
  // and a language left with no keys is dropped entirely (clean config, never
  // a trail of empty `{}` entries left behind).
  const setSub = (code: string, sub: string, text: string) => {
    const next: TranslationsValue = {}
    for (const [k, v] of Object.entries(current)) next[k] = { ...v }
    const langEntry = { ...(next[code] ?? {}) }
    if (text === '') {
      delete langEntry[sub]
    } else {
      langEntry[sub] = text
    }
    if (Object.keys(langEntry).length === 0) {
      delete next[code]
    } else {
      next[code] = langEntry
    }
    onChange('translations', next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {languages.map(code => {
        const languageName = t(`translations.languages.${code}`)
        return (
          <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionTitle as="div">{languageName}</SectionTitle>
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
                        field={{ key: sub, label: subLabel } as WorkflowField}
                        value={subValue}
                        onChange={(_key, next) => setSub(code, sub, (next as string) ?? '')} />}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
