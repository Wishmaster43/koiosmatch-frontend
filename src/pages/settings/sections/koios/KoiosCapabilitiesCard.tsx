/**
 * KoiosCapabilitiesCard — KOIOS-CAPABILITIES-FE-1 + KOIOS-TOOL-MATRIX-FE-1: the
 * tenant-facing tool matrix for Koios AI. Lists every tool the assistant can act
 * through, grouped by `kind` when the server sends one (tolerant: falls back to
 * one flat list rather than guessing a group vocabulary). Per tool: its label,
 * a confirm-required marker, a tenant on/off Toggle (optimistic, reverts on a
 * failed PATCH), a "reset to default" affordance when the tenant value diverges
 * from the platform default, and — when the backing integration is not
 * connected — a soft warning badge deep-linking to that integration's settings.
 *
 * §10 house-rule note: the generated `api-generated.ts` types only carry the 401
 * shape for this route today, so the response/tool interfaces below are
 * hand-typed against the measured contract in the worker brief (WORKLIST
 * KOIOS-CAPABILITIES-FE-1), not generated.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getKoiosCapabilities, updateKoiosCapabilityTool } from './koiosApi'
import { notifyError } from '@/lib/notify'
import Toggle from '@/components/ui/Toggle'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { SectionTitle, GroupLabel, Caption, BodyText, bodyTextStyle } from '@/components/ui/typography'

// Hand-typed response shape (see file header) — the measured GET /ai/koios/capabilities contract.
interface KoiosTool {
  name: string
  label_nl: string
  kind?: string | null
  confirm_required: boolean
  enabled_for_me: boolean
  enabled_for_tenant: boolean
  default_enabled: boolean
  connection_active: boolean | null
  connection: 'whatsapp' | 'shiftmanager' | 'helloflex' | 'pdok' | null
}
interface KoiosCapabilities {
  surfaces: string[]
  tools: KoiosTool[]
  limits: Record<string, unknown>
  models: { active_flavor: string; flavors: string[] }
}

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' } as const


// Deep-link hashes for a tool's backing integration, measured against the existing
// settings routes. Only WhatsApp has a confirmed settings screen today; the other
// three connections don't exist yet as sections (openQuestions), so those tools
// show an honest disabled title instead of a dead link.
const CONNECTION_HASH: Record<string, string> = { whatsapp: '#settings/whatsapp/whatsapp' }

// One tool row: label + confirm-required marker + connection badge + the tenant Toggle + reset affordance.
function ToolRow({ tool, onToggle, onReset, t }: { tool: KoiosTool; onToggle: (name: string, value: boolean) => void; onReset: (name: string) => void; t: (k: string, opts?: Record<string, unknown>) => string }) {
  const diverged = tool.enabled_for_tenant !== tool.default_enabled
  const connectionHash = tool.connection ? CONNECTION_HASH[tool.connection] : undefined
  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <BodyText style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{tool.label_nl}</span>
          {tool.confirm_required && <Caption>{t('capabilities.confirmRequired')}</Caption>}
          {tool.enabled_for_me === false && <Caption>{t('capabilities.disabledForMe')}</Caption>}
        </BodyText>
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

// The capabilities/tool-matrix card: loads once, groups by `kind` when present, and PATCHes one tool at a time (optimistic, reverts on failure).
export default function KoiosCapabilitiesCard() {
  const { t } = useTranslation('koios')
  const [data, setData] = useState<KoiosCapabilities | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  // Load capabilities once; a 403 is treated the same as any other load failure here
  // (the parent screen already degrades the whole section on 403).
  useEffect(() => {
    let alive = true
    getKoiosCapabilities()
      .then((d: unknown) => { if (alive) { setData(d as KoiosCapabilities); setPhase('ready') } })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [])

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
        const tools = (res as { tools?: KoiosTool[] })?.tools
        if (!tools) return
        setData((cur) => (cur ? {
          ...cur,
          // Server truth per tool, except tools with a NEWER in-flight patch.
          tools: cur.tools.map((tl) => {
            const srv = tools.find((sv) => sv.name === tl.name)
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

  if (phase === 'loading') return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.loading')}</p></div>
  if (phase === 'error') return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.loadError')}</p></div>
  if (!data || data.tools.length === 0) return <div style={card}><p style={{ ...bodyTextStyle, color: 'var(--text-muted)' }}>{t('capabilities.empty')}</p></div>

  // Group tools by `kind` only when at least one tool carries it — never invent
  // group names for a vocabulary the server didn't send (tolerant-by-contract).
  const hasKinds = data.tools.some((tl) => tl.kind)
  const groups = hasKinds
    ? Object.entries(data.tools.reduce<Record<string, KoiosTool[]>>((acc, tl) => {
        const key = tl.kind || t('capabilities.otherGroup')
        acc[key] = acc[key] || []
        acc[key].push(tl)
        return acc
      }, {}))
    : [[null, data.tools] as [string | null, KoiosTool[]]]

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('capabilities.title')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('capabilities.subtitle')}</div>
      {groups.map(([kind, tools]) => (
        <div key={kind ?? 'flat'}>
          {kind && <GroupLabel style={{ marginTop: 14 }}>{kind}</GroupLabel>}
          {tools.map((tool) => (
            <ToolRow key={tool.name} tool={tool} t={t}
              onToggle={(name, value) => patchTool(name, value)}
              onReset={(name) => patchTool(name, null)} />
          ))}
        </div>
      ))}
    </div>
  )
}
