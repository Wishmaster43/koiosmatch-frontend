/**
 * Shared primitives for the AI management tabs (Agents/Prompts/FAQ/Knowledge/Tools):
 * the model list + small reusable UI (Field, Badge, SaveBar, VersionList, TextEditor,
 * SideList, ListRow). Extracted from AIManagementTabs so each tab can live on its own.
 */
import { useState, useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Clock, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { interactive } from '@/lib/a11y'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { useDateFormat } from '@/lib/datetime'
import { notifySuccess } from '@/lib/notify'
import { fieldInputStyle, fieldTextareaStyle } from '@/components/forms/fieldMetrics'

// One saved version of a prompt/agent config.
export interface Version { version?: number; created_at?: string; body?: string; content?: string; [k: string]: unknown }

// Canon field style (G33/fieldMetrics) — was its own near-identical copy before the sweep.
// eslint-disable-next-line react-refresh/only-export-components -- a style constant re-export alongside this file's components; only one external caller (AgentForm.tsx), not worth a new module for
export const inputStyle: CSSProperties = fieldInputStyle

// ── shared helpers ────────────────────────────────────────────────────────────

export function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  // Associate the label with its single input via a generated id (§6).
  const id = useId()
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children
  return (
    <div style={{ marginBottom: 13 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {child}
    </div>
  )
}

export function Badge({ label, color, bg }: { label?: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export function SaveBar({ saving, saved, onSave }: { saving?: boolean; saved?: boolean; onSave?: () => void }) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {saved && (
        <span style={{ fontSize: 11, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Check size={11} /> {t('ai.saved')}
        </span>
      )}
      <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
        {saving
          ? <Spinner size={11} />
          : <Save size={11} />}
        {t('common:save')}
      </Button>
    </div>
  )
}

// CopyableValue — a read-only value (webhook URL, …) + click-to-copy icon, JetBrains
// Mono per §4. Mirrors ReferenceNumberChip's copy pattern but stays generic since this
// screen's value isn't a reference number.
export function CopyableValue({ value, copyLabel, copiedMessage }: { value: string; copyLabel: string; copiedMessage: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      notifySuccess(copiedMessage)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard API unavailable (older browser/permissions) — no-op */ }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <code style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</code>
      <Button variant="ghost" iconOnly onClick={copy} title={copyLabel} aria-label={copyLabel}>
        {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
      </Button>
    </div>
  )
}

export function VersionList({ versions, onRestore }: { versions?: Version[]; onRestore?: (v: Version) => void }) {
  const { t } = useTranslation('workflows')
  const { formatDateTime } = useDateFormat()
  const [open, setOpen] = useState(false)
  if (!versions?.length) return null
  return (
    <div style={{ marginTop: 6 }}>
      <Button variant="ghost" onClick={() => setOpen(o => !o)} style={{ padding: 0, fontSize: 11 }}>
        <Clock size={11} /> {t('ai.versions', { count: versions.length })}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Button>
      {open && (
        <div style={{ marginTop: 5, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {versions.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--bg)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                v{v.version ?? i + 1} — {v.created_at ? formatDateTime(v.created_at) : ''}
              </span>
              <Button variant="ghost" onClick={() => onRestore?.(v)}
                style={{ fontSize: 11, color: 'var(--color-primary-text)', padding: '1px 5px' }}>
                {t('ai.restore')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TextEditor({ value, onChange, onSave, saving, saved, versions, onRestore, placeholder, height = 220 }: {
  value?: string; onChange: (v: string) => void; onSave?: () => void; saving?: boolean; saved?: boolean
  // FAKE-AFFORDANCE (14-08): optional — a caller with no versions endpoint (e.g.
  // KnowledgeTab) omits both rather than pass a no-op restore handler.
  versions?: Version[]; onRestore?: (v: Version) => void; placeholder?: string; height?: number
}) {
  return (
    <div>
      {/* Multi-line control: base off the textarea canon (vertical padding, no fixed
          height) rather than the single-line inputStyle, which is now height-locked. */}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...fieldTextareaStyle, height, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <VersionList versions={versions} onRestore={onRestore} />
        <SaveBar saving={saving} saved={saved} onSave={onSave} />
      </div>
    </div>
  )
}

// ── SideList — reusable left-list + right-detail layout ──────────────────────

export function SideList<T extends { id?: string | number }>({ title, items, selected, onNew, loading, renderItem, children }: {
  title?: ReactNode; items: T[]; selected?: T | null; onNew?: () => void; loading?: boolean
  // onSelect is accepted for call-site symmetry but selection is wired via renderItem's ListRow.
  onSelect?: (item: T) => void
  renderItem: (item: T, active: boolean) => ReactNode; children?: ReactNode
}) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, height: '100%', minHeight: 0 }}>
      {/* List */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: '9px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <Button variant="ghost" iconOnly onClick={onNew} aria-label={t('common:add')}>
            <Plus size={13} />
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: '12px 11px', fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.loading')}</p>}
          {!loading && items.length === 0 && (
            <p style={{ padding: '12px 11px', fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.emptyStart')}</p>
          )}
          {items.map(item => renderItem(item, selected?.id === item.id))}
        </div>
      </div>
      {/* Detail */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, overflowY: 'auto', background: 'var(--surface)' }}>
        {children}
      </div>
    </div>
  )
}

export function ListRow<T>({ item, active, onSelect, label, sublabel, leading, onDelete }: {
  item: T; active?: boolean; onSelect: (item: T) => void; label?: ReactNode; sublabel?: ReactNode; leading?: ReactNode; onDelete?: (item: T) => void
}) {
  const { t } = useTranslation('common')
  return (
    <div {...interactive(() => onSelect(item))}
      style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12, gap: 8,
        background: active ? 'var(--color-primary-bg)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {leading}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
        <div style={{ fontWeight: 500, color: active ? 'var(--color-primary-text)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {onDelete && (
        // Icon-only control: needs an accessible name (§6). It also reveals on
        // keyboard focus, not just mouse hover — a colour-only reveal that never
        // fires for Tab navigation would leave it invisible-but-focusable.
        <button onClick={e => { e.stopPropagation(); onDelete(item) }}
          aria-label={t('delete')} title={t('delete')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- reveal-on-hover/focus row action (colour goes transparent→danger imperatively); not a static Button variant
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', padding: 2, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}
          onFocus={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onBlur={e => (e.currentTarget.style.color = 'transparent')}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}
