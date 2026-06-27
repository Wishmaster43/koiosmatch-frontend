/**
 * Shared primitives for the AI management tabs (Agents/Prompts/FAQ/Knowledge/Tools):
 * the model list + small reusable UI (Field, Badge, SaveBar, VersionList, TextEditor,
 * SideList, ListRow). Extracted from AIManagementTabs so each tab can live on its own.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Clock, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

// One selectable AI model.
export interface Model { value: string; label: string; provider: string; strength: string | null }
// One saved version of a prompt/agent config.
export interface Version { version?: number; created_at?: string; body?: string; content?: string; [k: string]: unknown }

export const MODELS: Model[] = [
  { value: 'gpt-4o',            label: 'GPT-4o',            provider: 'OpenAI',    strength: 'high' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o Mini',       provider: 'OpenAI',    strength: 'medium' },
  { value: 'gpt-4-turbo',       label: 'GPT-4 Turbo',       provider: 'OpenAI',    strength: 'high' },
  { value: 'o1-mini',           label: 'o1 Mini',           provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'o1',                label: 'o1',                provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'claude-opus-4-8',   label: 'Claude Opus 4',     provider: 'Anthropic', strength: 'high' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4',   provider: 'Anthropic', strength: 'medium' },
  { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4',    provider: 'Anthropic', strength: 'fast' },
  { value: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',    provider: 'Google',    strength: 'high' },
  { value: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  provider: 'Google',    strength: 'medium' },
  { value: 'custom',            label: 'Custom (eigen API)', provider: 'Custom',    strength: null },
]

// Strength → colour; label = t('ai.strength.<key>').
export const STRENGTH_COLORS: Record<string, string> = { high: '#7C3AED', medium: '#0369A1', fast: '#16A34A', reasoning: '#D97706' }

export const inputStyle: CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--input-bg)',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

// ── shared helpers ────────────────────────────────────────────────────────────

export function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
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
        <span style={{ fontSize: 11, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Check size={11} /> {t('ai.saved')}
        </span>
      )}
      <button onClick={onSave} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
          borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving
          ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
          : <Save size={11} />}
        {t('common:save')}
      </button>
    </div>
  )
}

export function VersionList({ versions, onRestore }: { versions?: Version[]; onRestore: (v: Version) => void }) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  if (!versions?.length) return null
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Clock size={11} /> {t('ai.versions', { count: versions.length })}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 5, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {versions.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--bg)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                v{v.version ?? i + 1} — {v.created_at ? new Date(v.created_at).toLocaleString() : ''}
              </span>
              <button onClick={() => onRestore(v)}
                style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px' }}>
                {t('ai.restore')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TextEditor({ value, onChange, onSave, saving, saved, versions, onRestore, placeholder, height = 220 }: {
  value?: string; onChange: (v: string) => void; onSave?: () => void; saving?: boolean; saved?: boolean
  versions?: Version[]; onRestore: (v: Version) => void; placeholder?: string; height?: number
}) {
  return (
    <div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, height, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
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
          <button onClick={onNew} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={13} />
          </button>
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

export function ListRow<T>({ item, active, onSelect, label, sublabel, onDelete }: {
  item: T; active?: boolean; onSelect: (item: T) => void; label?: ReactNode; sublabel?: ReactNode; onDelete?: (item: T) => void
}) {
  return (
    <div onClick={() => onSelect(item)}
      style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12,
        background: active ? 'var(--color-primary-bg)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 500, color: active ? 'var(--color-primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(item) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', padding: 2, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}
