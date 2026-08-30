/**
 * KoiosCapabilitiesCard — KOIOS-CAPABILITIES-FE-1 + KOIOS-TOOL-MATRIX-FE-1/2/3:
 * the tenant-facing tool matrix for Koios AI. Lists every tool the assistant can
 * act through, grouped on a real DOMAIN axis (useCapabilityGroups — derived from
 * `tool.connection` / `tool.name`, never the two-value read/write `kind`, which
 * the FE-2 round wrongly used as the grouping axis: measured 61 of 78 tools still
 * in one ~6200px tab, KOIOS-TOOL-MATRIX-FE-2 verdict finding 1) and switched via
 * a SubTabBar so only one domain renders at a time. Inside a domain, `kind`
 * (read/write) becomes a GroupLabel section header — its actual job. A search
 * box above the tabs (KOIOS-TOOL-MATRIX-FE-3) filters every tool across every
 * domain at once, replacing the tab strip with a flat result list while active.
 * Per tool: its label (clamped to two lines with a Meer/Minder expand
 * affordance), a confirm-required marker, a tenant on/off Toggle (optimistic,
 * reverts on a failed PATCH), a "reset to default" affordance when the tenant
 * value diverges from the platform default, and — when the backing integration
 * is not connected — a soft warning badge deep-linking to that integration's
 * settings.
 *
 * §10 house-rule note: the generated `api-generated.ts` types only carry the 401
 * shape for this route today, so the response/tool interfaces live in
 * useKoiosToolCapabilities, hand-typed against the measured contract (WORKLIST
 * KOIOS-CAPABILITIES-FE-1), not generated.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateKoiosCapabilityTool } from './koiosApi'
import { useQueryClient } from '@tanstack/react-query'
import {
  useKoiosToolCapabilities, KOIOS_CAPABILITIES_QUERY_KEY, KOIOS_CONNECTION_HASH,
  type KoiosCapabilities, type KoiosCapabilityTool,
} from '@/components/layout/koios/useKoiosToolCapabilities'
import { useCapabilityGroups } from './useCapabilityGroups'
import { notifyError } from '@/lib/notify'
import Toggle from '@/components/ui/Toggle'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import SubTabBar from '@/components/drawer/SubTabBar'
import HeaderSearch from '@/components/ui/HeaderSearch'
import { SectionTitle, GroupLabel, Caption, BodyText, bodyTextStyle } from '@/components/ui/typography'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const row = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' } as const
// Two-line label clamp — the "compact by default" half of the KOIOS-TOOL-MATRIX-FE-2
// row rework; `-webkit-line-clamp` is broadly supported (Chromium/WebKit/Firefox).
const clampStyle = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const

// One tool row: clamped label + expand affordance + confirm-required marker + connection badge + the tenant Toggle + reset affordance.
function ToolRow({ tool, onToggle, onReset, t }: { tool: KoiosCapabilityTool; onToggle: (name: string, value: boolean) => void; onReset: (name: string) => void; t: (k: string, opts?: Record<string, unknown>) => string }) {
  const diverged = tool.enabled_for_tenant !== tool.default_enabled
  const connectionHash = tool.connection ? KOIOS_CONNECTION_HASH[tool.connection] : undefined
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const labelRef = useRef<HTMLSpanElement>(null)

  // Detect whether the label actually overflows its 2-line clamp, so the
  // Meer/Minder affordance only shows up when a row genuinely needs it.
  useLayoutEffect(() => {
    const el = labelRef.current
    if (!el) return
    setTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [tool.label_nl])

  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <BodyText style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span ref={labelRef} style={expanded ? undefined : clampStyle}>{tool.label_nl}</span>
          {tool.confirm_required && <Caption>{t('capabilities.confirmRequired')}</Caption>}
          {tool.enabled_for_me === false && <Caption>{t('capabilities.disabledForMe')}</Caption>}
        </BodyText>
        {truncated && (
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 2 }}>
            {expanded ? t('capabilities.showLess') : t('capabilities.showMore')}
          </Button>
        )}
        {tool.connection_active === false && (
          <div style={{ marginTop: 6 }}>
            {connectionHash
              // CHIP-faced link (§6 navigation): a Button shell around a SoftChip
              // doubles the chrome (Opus-vondst) — the bare link only clears the
              // underline, the chip carries the whole face.
              ? <a href={connectionHash} className="no-underline"
                  aria-label={t('capabilities.connectionNeeded')}>
                  <SoftChip label={t('capabilities.connectionNeeded')} color="var(--color-warning)" />
                </a>
              : <SoftChip label={t('capabilities.connectionNeeded')} color="var(--color-warning)"
                  title={t('capabilities.connectionSectionMissing')} />}
          </div>
        )}
      </div>
      {diverged && (
        <Button size="sm" variant="ghost" onClick={() => onReset(tool.name)}>{t('capabilities.resetToDefault')}</Button>
      )}
      <Toggle checked={tool.enabled_for_tenant} onChange={(v) => onToggle(tool.name, v)}
        ariaLabel={t('capabilities.toggleAria', { label: tool.label_nl })} />
    </div>
  )
}

// One `kind` (read/write) section inside a domain tab: a GroupLabel header, then its rows.
function KindSection({ kind, tools, t, onToggle, onReset }: {
  kind: string; tools: KoiosCapabilityTool[]; t: (k: string, opts?: Record<string, unknown>) => string
  onToggle: (name: string, value: boolean) => void; onReset: (name: string) => void
}) {
  if (tools.length === 0) return null
  const kindLabel = kind === 'write' ? t('capabilities.kindWrite') : kind === 'read' ? t('capabilities.kindRead') : kind
  return (
    <div>
      <GroupLabel style={{ marginTop: 10 }}>{kindLabel} ({tools.length})</GroupLabel>
      {tools.map((tool) => (
        <ToolRow key={tool.name} tool={tool} t={t} onToggle={onToggle} onReset={onReset} />
      ))}
    </div>
  )
}

// The capabilities/tool-matrix card: loads once, groups on a domain axis (one
// SubTabBar tab per domain, `kind` as an in-tab section header), a search box
// filters flat across every domain, and PATCHes one tool at a time (optimistic,
// reverts on failure).
export default function KoiosCapabilitiesCard() {
  const { t } = useTranslation('koios')
  // The shared capabilities cache (one GET app-wide: this card + the pending-action
  // gate read the same entry); optimistic patches write it via setQueryData below.
  const queryClient = useQueryClient()
  const { capabilities: data, isLoading, isError } = useKoiosToolCapabilities()
  const phase = isLoading ? 'loading' : isError ? 'error' : 'ready'
  const setData = (updater: (cur: KoiosCapabilities | null) => KoiosCapabilities | null) =>
    queryClient.setQueryData<KoiosCapabilities | null>(KOIOS_CAPABILITIES_QUERY_KEY, (cur) => updater(cur ?? null))

  const tools = data?.tools ?? []
  const { groups, active, activeId, setActiveId, setQuery, searching, searchResults } = useCapabilityGroups(tools)

  // Names with a PATCH in flight — a late response never clobbers a newer optimistic toggle.
  const pendingRef = useRef(new Map<string, number>())
  // PATCH one tool (true/false/null): optimistic update first, ONE api call outside
  // any state updater (StrictMode double-invokes updaters — the Opus verify measured
  // a double PATCH in the first version), toast + exact revert on failure.
  const patchTool = (name: string, value: boolean | null) => {
    const prior = data?.tools.find((tl) => tl.name === name)
    if (!prior) return
    const nextEnabled = value === null ? prior.default_enabled : value
    setData((cur) => (cur ? { ...cur, tools: cur.tools.map((tl) => (tl.name === name ? { ...tl, enabled_for_tenant: nextEnabled } : tl)) } : cur))
    const seq = (pendingRef.current.get(name) ?? 0) + 1
    pendingRef.current.set(name, seq)
    updateKoiosCapabilityTool(name, value)
      .then((res: unknown) => {
        const resTools = (res as { tools?: KoiosCapabilityTool[] })?.tools
        if (!resTools) return
        setData((cur) => (cur ? {
          ...cur,
          // Server truth per tool, except tools with a NEWER in-flight patch.
          tools: cur.tools.map((tl) => {
            const srv = resTools.find((sv) => sv.name === tl.name)
            const pending = (pendingRef.current.get(tl.name) ?? 0) > (tl.name === name ? seq : 0)
            return srv && !pending ? srv : tl
          }),
        } : cur))
      })
      .catch(() => {
        notifyError(t('capabilities.saveError'))
        setData((cur) => (cur ? { ...cur, tools: cur.tools.map((tl) => (tl.name === name ? prior : tl)) } : cur))
      })
      .finally(() => { if (pendingRef.current.get(name) === seq) pendingRef.current.delete(name) })
  }
  const onToggle = (name: string, value: boolean) => patchTool(name, value)
  const onReset = (name: string) => patchTool(name, null)

  if (phase === 'loading') return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.loading')}</p></div>
  if (phase === 'error') return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.loadError')}</p></div>
  if (!data || data.tools.length === 0) return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.empty')}</p></div>

  // Within a domain tab, `write` tools render after `read` (read is the lighter,
  // more scannable half; matches the platform-wide read→write reading order).
  const kindsOf = (kind: string) => (active?.tools ?? []).filter((tl) => (tl.kind ?? '') === kind)
  const otherKind = (active?.tools ?? []).filter((tl) => tl.kind !== 'read' && tl.kind !== 'write')

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('capabilities.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{t('capabilities.subtitle')}</div>
      <HeaderSearch onSearch={setQuery} placeholder={t('capabilities.searchPlaceholder')}
        ariaLabel={t('capabilities.searchPlaceholder')} width="100%" />
      {searching ? (
        searchResults.length === 0
          ? <p style={{ ...bodyTextStyle, color: 'var(--text-muted)', marginTop: 10 }}>{t('capabilities.noResults')}</p>
          : searchResults.map((tool) => (
              <ToolRow key={tool.name} tool={tool} t={t} onToggle={onToggle} onReset={onReset} />
            ))
      ) : (
        <>
          {groups.length > 1 && (
            <div style={{ margin: '10px 0 4px' }}>
              <SubTabBar active={activeId ?? groups[0].id} onChange={(id) => setActiveId(id as typeof activeId)}
                tabs={groups.map((g) => ({ id: g.id, label: `${t(`capabilities.groups.${g.id}`)} (${g.tools.length})` }))} />
            </div>
          )}
          <KindSection kind="read" tools={kindsOf('read')} t={t} onToggle={onToggle} onReset={onReset} />
          <KindSection kind="write" tools={kindsOf('write')} t={t} onToggle={onToggle} onReset={onReset} />
          {otherKind.map((tool) => (
            <ToolRow key={tool.name} tool={tool} t={t} onToggle={onToggle} onReset={onReset} />
          ))}
        </>
      )}
    </div>
  )
}
