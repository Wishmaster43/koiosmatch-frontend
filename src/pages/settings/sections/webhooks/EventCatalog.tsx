/**
 * EventCatalog — the event filter for a subscription. Grouped pill toggles with a
 * search box and a per-group "select all", plus a global select-all / clear. It's
 * controlled: `value` is the array of selected event keys, edits flow via onChange.
 * Uses the shared PermissionToggle so the control matches the rest of settings.
 * Events come from the live GET /webhook-events catalog (useWebhookEventCatalog);
 * the static webhookEvents list is only its network-error fallback.
 */
import { useState, useMemo, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ShieldAlert } from 'lucide-react'
import { actionOf } from './webhookEvents'
import { labelOrRaw } from '@/lib/labelOrRaw'
import { eventKeyToI18nKey } from '@/components/layout/workflow/eventCatalog'
import { useWebhookEventCatalog } from './useWebhookEventCatalog'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { BodyText, Caption, SectionTitle, monoStyle } from '@/components/ui/typography'

interface EventCatalogProps {
  /** Controlled list of selected event keys. */
  value?: string[]
  /** Called with the full next selection whenever it changes. */
  onChange: (next: string[]) => void
}

// Enter or Space activates a role=button text label, like a native button would.
function activateOnKey(e: KeyboardEvent<HTMLSpanElement>, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run() }
}

// Controlled event-picker for a webhook subscription: grouped pill toggles with
// search and per-group/global select-all (see file docblock above).
export default function EventCatalog({ value = [], onChange }: EventCatalogProps) {
  const { t, i18n } = useTranslation(['settings', 'workflows'])
  const [query, setQuery] = useState('')
  const { groups: EVENT_GROUPS, isLoading, isFallback, meta } = useWebhookEventCatalog()
  const ALL_EVENTS = useMemo(() => EVENT_GROUPS.flatMap((g) => g.events), [EVENT_GROUPS])
  // Set form of the controlled `value` for O(1) membership checks below.
  const selected = useMemo(() => new Set(value), [value])

  // Honest fallback: an unlisted server group (a live catalogue can add one at any
  // time) shows its raw key instead of a leaked i18n path.
  const groupLabel  = (g: string) => labelOrRaw(t, i18n, `webhooks.events.groups.${g}`, g, 'settings')
  const actionLabel = (a: string) => labelOrRaw(t, i18n, `webhooks.events.actions.${a}`, a, 'settings')
  // A HelloFlex key is helloflex.<entity>.<verb>: the verb alone would make eight "created" rows
  // indistinguishable, so the row reads the full event label the trigger picker already has in the
  // workflows namespace (one source of truth); every other row keeps its action label.
  const eventLabel = (ev: string) => ev.startsWith('helloflex.') ? labelOrRaw(t, i18n, `triggers.events.${eventKeyToI18nKey(ev)}`, ev, 'workflows') : actionLabel(actionOf(ev) ?? '')

  // Filter events by raw key, group label or event label.
  const q = query.trim().toLowerCase()
  // Groups narrowed to the events matching the search query; a group with no
  // matching events drops out entirely rather than rendering empty.
  const groups = useMemo(() => EVENT_GROUPS
    .map(({ group, events }) => ({
      group,
      events: events.filter((ev: string) =>
        !q || ev.toLowerCase().includes(q) || groupLabel(group).toLowerCase().includes(q) || eventLabel(ev).toLowerCase().includes(q)),
    }))
    .filter((g) => g.events.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on q + EVENT_GROUPS only; groupLabel/actionLabel/eventLabel are recomputed on every render so they never go stale
    [q, EVENT_GROUPS])

  // Toggle a single event on/off.
  const toggle = (ev: string) => {
    const next = new Set(selected)
    if (next.has(ev)) next.delete(ev); else next.add(ev)
    onChange([...next])
  }

  // Select-all / clear for a whole group (uses the group's full, unfiltered list).
  const toggleGroup = (events: string[]) => {
    const allOn = events.every((e) => selected.has(e))
    const next = new Set(selected)
    events.forEach((e) => (allOn ? next.delete(e) : next.add(e)))
    onChange([...next])
  }

  const allSelected = ALL_EVENTS.every((e) => selected.has(e))

  // Loading state: the catalog request is still in flight (no fallback rendered yet).
  if (isLoading) {
    return <BodyText style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={13} /> {t('common.loadingShort')}</BodyText>
  }

  return (
    <div>
      {/* Network-error notice: the live catalog failed, showing the bundled fallback list instead */}
      {isFallback && (
        <Caption as="p" style={{ color: 'var(--color-warning-text)', marginBottom: 10 }}>{t('webhooks.events.catalogFallback')}</Caption>
      )}
      {/* Toolbar: search + global select-all/clear + selected count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('webhooks.events.search')}
            aria-label={t('webhooks.events.search')}
            style={{ width: '100%', height: 34, padding: '0 10px 0 32px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => onChange(allSelected ? [] : [...ALL_EVENTS])}>
          {allSelected ? t('webhooks.events.clear') : t('webhooks.events.selectAll')}
        </Button>
      </div>
      <Caption as="p" style={{ marginBottom: 12 }}>
        {t('webhooks.events.selectedCount', { count: selected.size })}
      </Caption>

      {/* Grouped event list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(({ group, events }) => {
          const fullGroup: string[] = EVENT_GROUPS.find((g) => g.group === group)?.events ?? []
          const groupAllOn = fullGroup.every((e: string) => selected.has(e))
          return (
            <div key={group} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Group header with a select-all toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--hover-bg)' }}>
                <PermissionToggle checked={groupAllOn} onChange={() => toggleGroup(fullGroup)} />
                <span role="button" tabIndex={0} onClick={() => toggleGroup(fullGroup)} onKeyDown={(e) => activateOnKey(e, () => toggleGroup(fullGroup))}
                  style={{ cursor: 'pointer' }}><SectionTitle as="span">{groupLabel(group)}</SectionTitle></span>
                <Caption style={{ marginLeft: 'auto' }}>
                  {fullGroup.filter((e: string) => selected.has(e)).length}/{fullGroup.length}
                </Caption>
              </div>
              {/* Events in the group */}
              {events.map((ev: string) => {
                // ONIX G-002 (BE lane D f0855053): the catalogue names the payload keys that may leave
                // per event (`fields`) and whether they carry personal data (`pii`) — both ride as
                // hover text on the row (a caveat is a title, never a dot), the pii one also as an icon.
                const m = meta[ev]
                const fieldsTitle = m && m.fields.length > 0 ? t('webhooks.events.fieldsTitle', { fields: m.fields.join(', ') }) : undefined
                const piiTitle = m?.pii ? t('webhooks.events.piiTitle') : undefined
                const title = [fieldsTitle, piiTitle].filter(Boolean).join(' · ') || undefined
                return (
                  <div key={ev} title={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
                    <PermissionToggle checked={selected.has(ev)} onChange={() => toggle(ev)} />
                    <span role="button" tabIndex={0} onClick={() => toggle(ev)} onKeyDown={(e) => activateOnKey(e, () => toggle(ev))}
                      style={{ cursor: 'pointer' }}><BodyText as="span">{eventLabel(ev)}</BodyText></span>
                    {m?.pii && <ShieldAlert size={12} aria-label={piiTitle} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <Caption as="code" style={{ ...monoStyle, marginLeft: 'auto' }}>{ev}</Caption>
                  </div>
                )
              })}
            </div>
          )
        })}
        {groups.length === 0 && (
          <BodyText style={{ color: 'var(--text-muted)', padding: '16px 0' }}>{t('webhooks.events.noResults')}</BodyText>
        )}
      </div>
    </div>
  )
}
