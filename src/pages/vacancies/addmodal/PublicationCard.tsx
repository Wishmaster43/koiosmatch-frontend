import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import Toggle from '@/components/ui/Toggle'
import { cardHead, cardBox } from '@/components/ui/modalCards'

export interface PublicationChannel { value: string; label: string; published: boolean }

const APP_FIELDS = ['cv', 'cover_letter', 'photo', 'remarks', 'interview_consent']

interface Props {
  published: boolean; onPublishedChange: (v: boolean) => void
  channels: PublicationChannel[]; onToggleChannel: (value: string, next: boolean) => void
  applicationSettings: Record<string, unknown>; onSettingChange: (field: string, value: unknown) => void
}

/**
 * PublicationCard — punt 20: `published`, `published_channels` and
 * `application_settings` all accepted at create (measured). Mirrors the
 * drawer's PublishingTab controls verbatim, including its honest-state notice
 * (channels are not wired to real job-board feeds yet) — only the persistence
 * path differs: here every value just rides the create POST body, no PATCH.
 */
export default function PublicationCard({ published, onPublishedChange, channels, onToggleChannel, applicationSettings, onSettingChange }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])

  const valueOptions = [
    { value: 'required', label: t('publishing.values.required') },
    { value: 'optional', label: t('publishing.values.optional') },
    { value: 'hidden',   label: t('publishing.values.hidden') },
  ]

  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardPublication')}</div>
      <div style={cardBox}>
        {/* Master published flag — the table/insights "Gepubliceerd" bucket. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('columns.published')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: published ? 'var(--color-success)' : 'var(--text-muted)' }}>
              {published ? t('publishedState.yes') : t('publishedState.no')}
            </span>
            <Toggle checked={published} onChange={onPublishedChange} ariaLabel={t('columns.published')} />
          </div>
        </div>

        {/* Application settings */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('publishing.applicationSettings')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {APP_FIELDS.map(field => (
              <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{t(`publishing.fields.${field}`)}</span>
                <div style={{ width: 150 }}>
                  <SelectMenu value={(applicationSettings[field] as string) ?? 'optional'} options={valueOptions}
                    onChange={(v: string) => onSettingChange(field, v)} menuWidth={150} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Job boards */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('publishing.channels')}</div>
          {/* Honest state (mirrors PublishingTab verbatim): the toggles record WHAT
              will be published; the real feeds are not live yet. */}
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', marginBottom: 10, background: 'var(--bg)' }}>
            {t('publishing.notLiveYet')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {channels.map(c => (
              <div key={c.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: c.published ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {c.published ? t('publishing.queuedOn') : t('publishing.notPublished')}
                  </span>
                  <Toggle checked={c.published} onChange={next => onToggleChannel(c.value, next)} ariaLabel={c.label} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
