/**
 * CatalogSection — the generic settings screen for one catalogue section
 * (DRAFT-SETTINGS-CATALOG-1 §2): the rows marked `ui: 'generic'` render through
 * SchemaSection; dedicated rows stay on their own screens. Four states: loading
 * skeleton, error banner with retry, empty notice, and the form.
 *
 * CATALOG-EMBED-1 (Danny 13-09, rows 21-24: "WhatsApp belongs with WhatsApp",
 * "belongs with candidates and systems", "must be part of every settings
 * screen!!"): the four generic catalogue nav screens (windows/retention/
 * messaging/email) are gone — every group now renders under its own entity's
 * screen via the optional `group` prop, narrowing to one titled block instead of
 * the whole section. F1 (Opus review 13-09): that block is HEADLESS in page mode
 * (its page title already names the section) and headed in embedded mode, by the
 * section title (default) or the row's own group label (`headedBy="group"`).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SchemaSection from '../components/SchemaSection'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { SkeletonRows } from '../components/SettingsKit'
import { BodyText, PageTitle } from '@/components/ui/typography'
import { useSettingsCatalog } from '../catalog/useSettingsCatalog'
import { catalogToSchema } from '../catalog/catalogToSchema'

interface CatalogSectionProps {
  // Fixed section id from the contract (windows, retention, messaging, email, kpi, …).
  section: string
  // CATALOG-EMBED-1: narrow to just this one group's rows (e.g. "candidates" on
  // "windows"), rendered as a single block under the section's own title/icon —
  // the host screen already names the entity. Omit to render every group — still
  // used today by the whole-section embeds (CompanySettings, ActionRulesSettings,
  // VacancyMatchingSettings's "matching"/"vacancies" blocks), unaffected by `group`.
  group?: string
  // F1 (Opus review 13-09): which label the single narrowed block reads, when
  // headed. 'section' (default) repeats the section's own title — fine when the
  // host names a DIFFERENT concept (WhatsApp hosting "windows/conversations").
  // 'group' reads the row's own group label instead, for a host whose page title
  // already says the section itself (candidate retention hosting "retention/candidates").
  headedBy?: 'section' | 'group'
  // CATALOG-GROUPS-1: rendered under a dedicated screen (company, action_rules, …) —
  // no page title of its own, the grouped blocks and the Save bar only.
  embedded?: boolean
}

export default function CatalogSection({ section, group, headedBy, embedded = false }: CatalogSectionProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { sections, isLoading, isError, refetch } = useSettingsCatalog()

  // The schema is derived once per catalogue load; catalogToSchema drops dedicated
  // rows. F1: a group-narrowed block is headed only in embedded mode — page mode
  // already shows the section title as its own PageTitle below.
  const schema = useMemo(() => {
    const found = sections.find(s => s.id === section)
    // A section the BE hides has no generic screen — it reads as empty, never as raw rows.
    return found && !found.hidden
      ? catalogToSchema(section, found.keys, { groups: found.groups, color: found.color, group, sectionIcon: found.icon, headed: embedded, headedBy })
      : null
  }, [sections, section, group, embedded, headedBy])

  if (isLoading) return <SkeletonRows />
  if (isError) {
    return (
      <ErrorBanner onRetry={() => { void refetch() }} retryLabel={t('common:error.retry')}>
        {t('common:error.loadFailed')}
      </ErrorBanner>
    )
  }
  if (!schema || schema.fields.length === 0) {
    // Embedded: an empty block never shows the "no settings" notice — the host
    // screen stands on its own (§3B rule, unaffected by `group`).
    if (embedded) return null
    // F4 (§3 four states — a blank pane is never acceptable): a group-narrowed
    // PAGE never renders emptily. Its heading was going to be the section title
    // anyway (F1's default), so show that plus the honest empty notice.
    if (group) {
      return (
        <div>
          <PageTitle style={{ marginBottom: 8 }}>{t(`settings:catalog.sections.${section}.title`)}</PageTitle>
          <BodyText style={{ padding: '24px 0', color: 'var(--text-muted)' }}>{t('settings:catalog.empty')}</BodyText>
        </div>
      )
    }
    return <BodyText style={{ padding: '24px 0', color: 'var(--text-muted)' }}>{t('settings:catalog.empty')}</BodyText>
  }
  return <SchemaSection schema={schema} embedded={embedded} />
}
