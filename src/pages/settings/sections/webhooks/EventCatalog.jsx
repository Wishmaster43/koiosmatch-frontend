/**
 * EventCatalog — the event filter for a subscription. Grouped pill toggles with a
 * search box and a per-group "select all", plus a global select-all / clear. It's
 * controlled: `value` is the array of selected event keys, edits flow via onChange.
 * Uses the shared PermissionToggle so the control matches the rest of settings.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { EVENT_GROUPS, ALL_EVENTS, actionOf } from './webhookEvents'
import { PermissionToggle } from '@/pages/settings/components/SettingsControls'

export default function EventCatalog({ value = [], onChange }) {
  const { t } = useTranslation('settings')
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const groupLabel  = (g) => t(`webhooks.events.groups.${g}`)
  const actionLabel = (a) => t(`webhooks.events.actions.${a}`, { defaultValue: a })

  // Filter events by raw key, group label or action label.
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => EVENT_GROUPS
    .map(({ group, events }) => ({
      group,
      events: events.filter((ev) =>
        !q || ev.toLowerCase().includes(q) || groupLabel(group).toLowerCase().includes(q) || actionLabel(actionOf(ev)).toLowerCase().includes(q)),
    }))
    .filter((g) => g.events.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q])

  // Toggle a single event on/off.
  const toggle = (ev) => {
    const next = new Set(selected)
    if (next.has(ev)) next.delete(ev); else next.add(ev)
    onChange([...next])
  }

  // Select-all / clear for a whole group (uses the group's full, unfiltered list).
  const toggleGroup = (events) => {
    const allOn = events.every((e) => selected.has(e))
    const next = new Set(selected)
    events.forEach((e) => (allOn ? next.delete(e) : next.add(e)))
    onChange([...next])
  }

  const allSelected = ALL_EVENTS.every((e) => selected.has(e))

  return (
    <div>
      {/* Toolbar: search + global select-all/clear + selected count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('webhooks.events.search')}
            style={{ width: '100%', height: 34, padding: '0 10px 0 32px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }} />
        </div>
        <button onClick={() => onChange(allSelected ? [] : [...ALL_EVENTS])}
          style={{ height: 34, padding: '0 12px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)', whiteSpace: 'nowrap' }}>
          {allSelected ? t('webhooks.events.clear') : t('webhooks.events.selectAll')}
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        {t('webhooks.events.selectedCount', { count: selected.size })}
      </p>

      {/* Grouped event list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(({ group, events }) => {
          const fullGroup = EVENT_GROUPS.find((g) => g.group === group)?.events ?? []
          const groupAllOn = fullGroup.every((e) => selected.has(e))
          return (
            <div key={group} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Group header with a select-all toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--hover-bg)' }}>
                <PermissionToggle checked={groupAllOn} onChange={() => toggleGroup(fullGroup)} />
                <span onClick={() => toggleGroup(fullGroup)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>{groupLabel(group)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {fullGroup.filter((e) => selected.has(e)).length}/{fullGroup.length}
                </span>
              </div>
              {/* Events in the group */}
              {events.map((ev) => (
                <div key={ev} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
                  <PermissionToggle checked={selected.has(ev)} onChange={() => toggle(ev)} />
                  <span onClick={() => toggle(ev)} style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>{actionLabel(actionOf(ev))}</span>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{ev}</code>
                </div>
              ))}
            </div>
          )
        })}
        {groups.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>{t('webhooks.events.noResults')}</p>
        )}
      </div>
    </div>
  )
}
