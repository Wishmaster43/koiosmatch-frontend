/**
 * EmbedOriginsCard — the websites allowed to embed the public career site in a frame
 * (CAREER-EMBED-FE-1; ONIX rows Y-005 / L-004, decision 11e). Stored as a JSON list in
 * `career_site_embed_origins`; every add/remove saves immediately. Validation lives in
 * embedOrigins.ts so a bad value never reaches the server (empty list = embedding off).
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { saveSettingsKeys, invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { CANON_LABEL_STYLE, CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'
import { SettingCard } from '@/pages/settings/components/SettingsKit'
import { SectionTitle, Caption, BodyText, Mono } from '@/components/ui/typography'
import { EMBED_ORIGINS_MAX, parseEmbedOrigins, addEmbedOrigin, type EmbedOriginError } from './embedOrigins'

const SETTING_KEY = 'career_site_embed_origins'

// Card with the origin list, an add row and an inline validation message.
export default function EmbedOriginsCard({ stored }: { stored: unknown }) {
  const { t } = useTranslation('settings')
  const stableOrigins = parseEmbedOrigins(stored)
  const [list, setList] = useState<string[]>(stableOrigins)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<EmbedOriginError | null>(null)
  const inputId = useId()
  const errId = useId()
  const full = list.length >= EMBED_ORIGINS_MAX
  const tooMany = t('careerSite.embedOrigins.errors.tooMany', { max: EMBED_ORIGINS_MAX })

  // Persist the next list at once; a failed save reverts the local list and refetches the truth.
  const persist = (next: string[]) => {
    setList(next)
    saveSettingsKeys({ [SETTING_KEY]: next }).catch(() => {
      setList(stableOrigins)
      invalidateAllSettingsCache()
      notifyError(t('careerSite.saveError'))
    })
  }

  // Validate the draft; on success save, on failure show the matching error and send nothing.
  const add = () => {
    const result = addEmbedOrigin(list, draft)
    if ('error' in result) { setError(result.error); return }
    setError(null)
    setDraft('')
    persist(result.list)
  }

  // Remove one origin and save the shorter list.
  const remove = (origin: string) => persist(list.filter(o => o !== origin))

  return (
    <SettingCard style={{ marginTop: 12 }}>
      <SectionTitle>{t('careerSite.embedOrigins.title')}</SectionTitle>
      <Caption as="p" style={{ margin: '4px 0 10px' }}>{t('careerSite.embedOrigins.hint', { max: EMBED_ORIGINS_MAX })}</Caption>

      {/* The saved origins, or the honest "embedding is off" line. */}
      {list.length === 0 ? (
        <Caption as="p">{t('careerSite.embedOrigins.empty')}</Caption>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map(origin => (
            <li key={origin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hover-bg)' }}>
              {/* BodyText sets the 13 px house size; Mono only swaps the family. */}
              <BodyText as="span"><Mono>{origin}</Mono></BodyText>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('careerSite.embedOrigins.remove', { origin })} onClick={() => remove(origin)}>
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add row, label LEFT at the canon width like the sibling cards; Enter in the input adds as well. */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <label htmlFor={inputId} style={{ ...CANON_LABEL_STYLE, paddingTop: 8 }}>{t('careerSite.embedOrigins.add')}</label>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id={inputId}
              type="url"
              value={draft}
              disabled={full}
              placeholder={t('careerSite.embedOrigins.placeholder')}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              onChange={e => { setDraft(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              style={{ ...fieldInputStyle, flex: 1, borderColor: error ? 'var(--color-danger)' : 'var(--border)' }}
            />
            <DrawerAddButton onClick={add} label={t('careerSite.embedOrigins.addAction')} disabled={full}
              title={full ? tooMany : undefined} ariaDescription={full ? tooMany : undefined} />
          </div>
        </div>
        {error && (
          <span id={errId} role="alert" style={{ marginLeft: CANON_LABEL_WIDTH + 10 }}>
            <Caption as="span" style={{ color: 'var(--color-danger-text)' }}>
              {t(`careerSite.embedOrigins.errors.${error}`, { max: EMBED_ORIGINS_MAX })}
            </Caption>
          </span>
        )}
        <Caption style={{ marginLeft: CANON_LABEL_WIDTH + 10 }}>{t('careerSite.embedOrigins.counter', { n: list.length, max: EMBED_ORIGINS_MAX })}</Caption>
      </div>
    </SettingCard>
  )
}
