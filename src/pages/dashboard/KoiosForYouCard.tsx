/**
 * KoiosForYouCard — "Koios deed dit voor jou" (K0-D noordster report): the
 * tenant's Koios-TRIGGERED workflow runs over a chosen period. GET
 * /ai/koios/for-you?from=&to= (Y-m-d, wins over days) → { from, to, period,
 * actions_total, per_type, per_source, latest[], actions[<=200],
 * actions_truncated } — same telbron as the invoice's workflow-token ledger,
 * so this card and the billing screen always agree. A manual/event run never
 * counts.
 *
 * KOIOS-KAART-COMPACT-2 (Danny 24-08, backend contract K-174): the category
 * chips become real KPI tiles (StatTile, click-to-select); the selected tile
 * opens a DataTable of that category's actions[] with a deep link + new-tab
 * icon per row (EntityLink); the 7/30-day toggle becomes a period picker
 * (this week default / last week / 30 days / custom range) driving from/to.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import StatTile from '@/components/ui/StatTile'
import SegmentedControl from '@/components/ui/SegmentedControl'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/DataTable'
import EntityLink, { buildEntityDeepLink } from '@/components/ui/EntityLink'
import { GroupLabel, SectionTitle, Caption } from '@/components/ui/typography'

// Preset period keys driving the from/to computation — 'thisWeek' is the
// default (Monday through today), 'custom' opens the two date inputs.
type PeriodPreset = 'thisWeek' | 'lastWeek' | 'last30' | 'custom'

// One created record referenced by an action row (K-174: `created`), or null
// when the action created nothing resolvable.
interface KoiosForYouCreated {
  entity_type: string
  entity_id: string | number
  // Nullable on the wire: the linked record may be deleted after creation
  // (the backend plucks labels via whereIn — a miss stays null).
  label: string | null
}

// One Koios-triggered action row, as returned in the `actions` array (K-174).
interface KoiosForYouAction {
  id: string | number
  type: string
  source: string
  executed_at: string | null
  status: string
  created: KoiosForYouCreated | null
}

// The full report shape — hand-written (§10: no api-generated.ts entry for this
// route yet; type what the spec gives, hand-write the rest).
interface KoiosForYouReport {
  from?: string
  to?: string
  period: string
  actions_total: number
  per_type: Record<string, number>
  per_source: Record<string, number>
  actions: KoiosForYouAction[]
  actions_truncated: boolean
}

// Turn a workflow template_key ("koios_create_task") into a readable label —
// these are backend workflow identifiers, not app copy, so a display transform
// (not a translation) is the right treatment, mirroring how slugs read elsewhere.
function humanizeKey(key: string | null | undefined): string {
  if (!key) return '—'
  return key.replace(/^koios_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// KOIOS-KAART-COMPACT-1/2: bucket every action type into one of eight display
// categories. Measured real template_key values (BE Workflow model / seeded
// native templates, koiosmatch-api database/): koios_create_task,
// koios_send_whatsapp, koios_plan_appointment, koios_send_email,
// koios_send_notification, koios_add_to_calllist. Rejection/application/
// birthday automations don't have template keys yet but keep their own bucket
// so a future one lands correctly without a code change; anything matching no
// keyword falls into 'other' — an unknown type is NEVER dropped. (Source
// buckets — note/conversation/chat — no longer render as their own column in
// COMPACT-2's table; the action type + created record carry the row.)
const CATEGORY_ORDER = ['tasks', 'whatsapp', 'appointments', 'emails', 'rejections', 'applications', 'birthdays', 'other'] as const
type Category = (typeof CATEGORY_ORDER)[number]

// Raw action-type keys (koios_ prefix stripped) that have a translated label —
// anything outside this set gets the humanized fallback, never a raw i18n key
// (never a raw i18n key rendered straight from the backend key).
const KNOWN_ACTION_TYPES = ['create_task', 'send_whatsapp', 'plan_appointment', 'send_email', 'send_notification', 'add_to_calllist']

// Keyword match on the normalized (prefix-stripped) key → category bucket.
function categoryOf(rawKey: string | null | undefined): Category {
  const k = (rawKey || '').replace(/^koios_/, '')
  if (/task/.test(k)) return 'tasks'
  if (/whatsapp/.test(k)) return 'whatsapp'
  if (/appointment/.test(k)) return 'appointments'
  if (/email/.test(k)) return 'emails'
  if (/reject/.test(k)) return 'rejections'
  if (/application|apply/.test(k)) return 'applications'
  if (/birthday/.test(k)) return 'birthdays'
  return 'other'
}

// K-174 `created.entity_type` → app-shell page key (mirrors NotificationBell's
// ENTITY_PAGE, K-157 vocabulary — 'application': 'applications', 'candidate':
// 'candidates' verified there). 'appointment' and 'whatsapp' have NO dedicated
// page yet (grepped components/layout/appPages.tsx — no agenda/appointments or
// whatsapp-thread route exists), so they stay unmapped on purpose: the row
// renders as plain text rather than a link to nowhere. Extend this table,
// never invent a route.
const CREATED_ENTITY_PAGE: Record<string, string> = {
  task: 'tasks',
  calllist: 'outreach',
  application: 'applications',
  candidate: 'candidates',
}

// Local calendar-day 'YYYY-MM-DD' — never toISOString().slice(0,10), see
// lib/datetime's own docblock on the UTC-rollback bug.
function toIsoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Monday of the week containing `d` (ISO week start).
function mondayOf(d: Date): Date {
  const copy = new Date(d)
  const dow = copy.getDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  copy.setDate(copy.getDate() + diff)
  return copy
}

// Resolve a preset into a concrete { from, to } pair, given "now" (injectable
// for tests). 'custom' resolves from the caller-supplied inputs.
function resolveRange(preset: PeriodPreset, now: Date, customFrom: string, customTo: string): { from: string; to: string } {
  if (preset === 'custom') return { from: customFrom, to: customTo }
  if (preset === 'last30') {
    const to = new Date(now)
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { from: toIsoDay(from), to: toIsoDay(to) }
  }
  const thisMonday = mondayOf(now)
  if (preset === 'lastWeek') {
    const from = new Date(thisMonday)
    from.setDate(from.getDate() - 7)
    const to = new Date(thisMonday)
    to.setDate(to.getDate() - 1)
    return { from: toIsoDay(from), to: toIsoDay(to) }
  }
  // 'thisWeek' — default: Monday through today.
  return { from: toIsoDay(thisMonday), to: toIsoDay(now) }
}

interface KoiosForYouCardProps {
  // Header title override — the management performance face reuses this exact
  // card (Danny 24-08: same tiles, same expand, never a second idiom).
  title?: string
  // K-182 scope: 'me' = own actions, 'team'/undefined = tenant-wide. Ignored
  // when scopeToggle is true — the internal toggle state then wins.
  scope?: 'me' | 'team'
  // K-182 PLAN-DASHBOARD-PER-ROL-V3: only recruitment_manager/sales_manager get
  // the "mij / mijn team" toggle in the header. Default false = today's behavior.
  scopeToggle?: boolean
  // Compact extra strip rendered at the card's bottom (performance numbers).
  footer?: ReactNode
}

// See the file's top doc above for the for-you endpoint and the period-picker/KPI-tile drilldown it drives.
export default function KoiosForYouCard({ title, scope, scopeToggle = false, footer }: KoiosForYouCardProps = {}) {
  const { t } = useTranslation(['dashboard', 'common'])
  const { formatDateTime } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  // Period preset — 'thisWeek' is the default (KOIOS-KAART-COMPACT-2 spec).
  const [preset, setPreset] = useState<PeriodPreset>('thisWeek')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  // Which category tile is selected — null = none, table stays hidden.
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  // K-182: manager-scope toggle, own actions by default — only rendered/used
  // when scopeToggle is true; otherwise the `scope` prop (or none) governs.
  const [toggledScope, setToggledScope] = useState<'me' | 'team'>('me')
  const effectiveScope = scopeToggle ? toggledScope : scope

  const { from, to } = useMemo(() => resolveRange(preset, new Date(), customFrom, customTo), [preset, customFrom, customTo])
  // A custom range is only "ready" once both ends are filled and ordered.
  const customReady = preset !== 'custom' || (!!customFrom && !!customTo && customFrom <= customTo)

  // Koios-triggered workflow runs only (never a manual/event run) — the query
  // itself IS the data-fetching hook (§3), no separate wrapper needed for one call.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['koios', 'for-you', from, to, effectiveScope ?? 'all'],
    enabled: customReady,
    queryFn: async ({ signal }) =>
      unwrap<KoiosForYouReport>(await api.get('/ai/koios/for-you', { params: { from, to, ...(effectiveScope ? { scope: effectiveScope } : {}) }, signal })),
  })

  // Known action type → translated label; unknown types (a future automation)
  // get the humanized fallback, so the DOM never shows a raw English key.
  const actionLabel = (rawKey: string | null | undefined) => {
    const norm = (rawKey || '').replace(/^koios_/, '')
    return KNOWN_ACTION_TYPES.includes(norm) ? t(`koiosForYou.actionType.${norm}`) : humanizeKey(rawKey)
  }

  // Category → total count, from per_type — drives the KPI tile row.
  const categoryCounts: Record<Category, number> = data
    ? CATEGORY_ORDER.reduce((acc, c) => {
        acc[c] = 0
        return acc
      }, {} as Record<Category, number>)
    : ({} as Record<Category, number>)
  if (data) {
    Object.entries(data.per_type).forEach(([key, count]) => {
      categoryCounts[categoryOf(key)] += count
    })
  }
  const activeCategories = data
    ? CATEGORY_ORDER.filter((c) => categoryCounts[c] > 0).sort((a, b) => categoryCounts[b] - categoryCounts[a])
    : []

  // Actions of the selected category, newest first (actions[] already arrives
  // newest-first per K-174 — filtering preserves that order).
  const selectedActions = data && selectedCategory
    ? data.actions.filter((a) => categoryOf(a.type) === selectedCategory)
    : []

  // Table columns for the selected category's action list.
  const columns = [
    {
      key: 'type',
      header: t('koiosForYou.col.action'),
      render: (row: KoiosForYouAction) => actionLabel(row.type),
    },
    {
      key: 'created',
      header: t('koiosForYou.col.record'),
      render: (row: KoiosForYouAction) => {
        if (!row.created) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        // label is nullable on the wire: the record was deleted after Koios
        // created it (BillingReport plucks labels via whereIn — a miss stays
        // null). No label = nothing to link to; honest fallback, never an
        // empty link to a dead record.
        if (!row.created.label) return <Caption>{t('koiosForYou.recordGone')}</Caption>
        const page = CREATED_ENTITY_PAGE[row.created.entity_type]
        // Unknown/unmapped entity_type (incl. 'appointment', no page yet):
        // plain text, never a link to nowhere.
        if (!page) return <span>{row.created.label}</span>
        const deepLink = buildEntityDeepLink(page, row.created.entity_id)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <EntityLink page={page} id={row.created.entity_id} hideIcon>{row.created.label}</EntityLink>
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              aria-label={t('common:openInNewTab')}
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} />
            </Button>
          </span>
        )
      },
    },
    {
      key: 'executed_at',
      header: t('koiosForYou.col.executedAt'),
      render: (row: KoiosForYouAction) => formatDateTime(row.executed_at),
      nowrap: true,
    },
    {
      key: 'status',
      header: t('koiosForYou.col.status'),
      render: (row: KoiosForYouAction) => {
        const ok = row.status === 'completed'
        const failed = row.status === 'failed'
        const Icon = ok ? CheckCircle : failed ? AlertCircle : Clock
        const color = ok ? 'var(--color-success)' : failed ? 'var(--color-danger)' : 'var(--text-muted)'
        // Translated status with a visible text twin — colour/icon is never the
        // only signal (§6) and a raw wire value never reaches the a11y tree (§5).
        const statusLabel = t(`koiosForYou.status.${row.status}`, { defaultValue: humanizeKey(row.status) })
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon size={14} color={color} aria-hidden="true" />
            <Caption>{statusLabel}</Caption>
          </span>
        )
      },
      nowrap: true,
    },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {/* Header — Koios mark carries the AI-Act disclosure hint as a tooltip
          (mirrors KoiosAdviceBlock: the title already names Koios explicitly, so
          this isn't a bare icon), title, and the period picker. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <KoiosAiMark size={18} title={t('common:aiGeneratedHint')} />
        <SectionTitle style={{ flex: 1 }}>{title ?? t('koiosForYou.title')}</SectionTitle>
        {/* K-182 manager scope toggle — only the two manager roles get this
            (PLAN-DASHBOARD-PER-ROL-V3); default 'me', switch to 'team'. */}
        {scopeToggle && (
          <SegmentedControl
            size="compact"
            ariaLabel={t('koiosForYou.scopeLabel')}
            value={toggledScope}
            onChange={(v) => setToggledScope(v as 'me' | 'team')}
            options={[
              { value: 'me', label: t('koiosForYou.scope.me') },
              { value: 'team', label: t('koiosForYou.scope.team') },
            ]}
          />
        )}
        <SegmentedControl
          size="compact"
          ariaLabel={t('koiosForYou.periodLabel')}
          value={preset}
          onChange={(v) => setPreset(v as PeriodPreset)}
          options={[
            { value: 'thisWeek', label: t('koiosForYou.periodPreset.thisWeek') },
            { value: 'lastWeek', label: t('koiosForYou.periodPreset.lastWeek') },
            { value: 'last30', label: t('koiosForYou.periodPreset.last30') },
            { value: 'custom', label: t('koiosForYou.periodPreset.custom') },
          ]}
        />
        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label>
              <span className="sr-only">{t('koiosForYou.rangeFrom')}</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                style={{ height: 28, fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px' }} />
            </label>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
            <label>
              <span className="sr-only">{t('koiosForYou.rangeTo')}</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                style={{ height: 28, fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px' }} />
            </label>
          </div>
        )}
      </div>

      {/* Loading — the report for the active period is in flight. */}
      {isLoading && customReady && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
          <Spinner size={16} />
          <span style={{ fontSize: 12 }}>{t('common:loading')}</span>
        </div>
      )}

      {/* Waiting on a custom range — neither loading nor an error, just an honest prompt. */}
      {!customReady && (
        <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
          {t('koiosForYou.pickRange')}
        </div>
      )}

      {/* Error — the report call failed (e.g. missing koios.use permission, or a
          transient network error); a calm banner with retry, never a blank card. */}
      {!isLoading && isError && (
        <ErrorBanner onRetry={() => refetch()}>{t('koiosForYou.loadError')}</ErrorBanner>
      )}

      {/* Empty — no Koios-triggered runs in the selected period. */}
      {!isLoading && !isError && data && data.actions_total === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t('koiosForYou.empty')}</div>
          <div style={{ fontSize: 12 }}>{t('koiosForYou.emptySub')}</div>
        </div>
      )}

      {/* Success — hero total, KPI-tile category row, per-category table on select. */}
      {!isLoading && !isError && data && data.actions_total > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{formatNumber(data.actions_total)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('koiosForYou.heroLabel')}</span>
          </div>

          {/* KPI tile row — one equal-footprint StatTile per active category;
              clicking a tile selects it (toggles off on a second click), which
              reveals the per-category action table below. */}
          {activeCategories.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <GroupLabel style={{ marginBottom: 6 }}>{t('koiosForYou.breakdownTitle')}</GroupLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {activeCategories.map((c) => (
                  <StatTile
                    key={c}
                    label={t(`koiosForYou.category.${c}`)}
                    value={formatNumber(categoryCounts[c])}
                    size="sm"
                    accent={selectedCategory === c}
                    pressed={selectedCategory === c}
                    onClick={() => setSelectedCategory((cur) => (cur === c ? null : c))}
                    style={selectedCategory === c ? { borderColor: 'var(--color-primary)' } : undefined}
                  />
                ))}
              </div>
              {/* Payload-level truncation: the server caps actions[] at 200 for
                  the WHOLE period — say so at the row that shows the totals,
                  not inside one category's table (§3 honesty). */}
              {data.actions_truncated && (
                <Caption style={{ display: 'block', marginTop: 6 }}>{t('koiosForYou.truncated')}</Caption>
              )}
            </div>
          )}

          {/* Selected category's action table — the per-run detail, filtered to
              the chosen category, deep-linking to the created record. */}
          {selectedCategory && (
            <div>
              <GroupLabel style={{ marginBottom: 6 }}>{t(`koiosForYou.category.${selectedCategory}`)}</GroupLabel>
              <DataTable<KoiosForYouAction>
                columns={columns}
                rows={selectedActions}
                getRowId={(row) => row.id}
                emptyText={t('koiosForYou.noActionsInCategory')}
              />
            </div>
          )}
        </>
      )}

      {/* Compact extra strip (performance face) — same card, one idiom. */}
      {footer}
    </div>
  )
}
