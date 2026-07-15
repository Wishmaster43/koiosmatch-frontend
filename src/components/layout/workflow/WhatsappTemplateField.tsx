/**
 * WhatsappTemplateField — Make-style template mapping for the whatsapp_send step.
 * Loads the tenant's approved templates (GET /whatsapp-templates, raw Meta
 * components included), renders the message as a filled-in preview (each {{n}}
 * slot shows the mapped field as a chip, or the real sample value from the last
 * run/test output), and one variable-picker input per slot. Values persist in the
 * existing BE contract: `header_variables` / `variables`, one value per line in
 * slot order. Unknown templates fall back to the raw textareas.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { TextFieldWithVars } from './VariablePicker'
import {
  templateTexts, slotCount, splitSlots, splitTokens, toLines, setLine,
  type WaTemplateOption,
} from './whatsappTemplate'
import type { WorkflowVarGroup } from '@/types/workflow'
import type { OnChange } from './fieldControls'
import { unwrapList } from '@/lib/api'

// ── Preview rendering ────────────────────────────────────────────────────────────

const chipStyle = {
  display: 'inline-block', padding: '0 5px', borderRadius: 5, fontSize: 11,
  fontFamily: 'monospace', background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
  border: '1px solid var(--border)', lineHeight: '16px', verticalAlign: 'baseline',
} as const

// One {{n}} slot inside the preview: sample value when known, else a field chip.
function SlotValue({ mapped, samples, n }: { mapped: string; samples: Record<string, string>; n: number }) {
  const { t } = useTranslation('workflows')
  // Empty mapping → a dashed placeholder chip so the gap is visible (not colour-only).
  if (!mapped.trim()) {
    return (
      <span title={t('wa.emptySlot')} style={{ ...chipStyle, borderStyle: 'dashed', background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
        {'{{'}{n}{'}}'}
      </span>
    )
  }
  // Mapped value: literals render as-is; {{field}} tokens show the sample or a [field] chip.
  return (
    <>
      {splitTokens(mapped).map((seg, i) => {
        if (seg.literal != null) return <span key={i}>{seg.literal}</span>
        const field = seg.field ?? ''
        const sample = samples[field] ?? samples[field.split('.').pop() ?? '']
        return sample != null
          ? <span key={i} title={`{{${field}}}`} style={{ borderBottom: '1px dotted var(--color-primary)', fontWeight: 600 }}>{sample}</span>
          : <span key={i} style={chipStyle}>[{field}]</span>
      })}
    </>
  )
}

// The message as the candidate receives it: header (bold) · body · footer (muted).
function TemplatePreview({ header, body, footer, headerLines, bodyLines, samples }: {
  header?: string; body?: string; footer?: string
  headerLines: string[]; bodyLines: string[]; samples: Record<string, string>
}) {
  const { t } = useTranslation('workflows')
  const renderText = (text: string, lines: string[], style: CSSProperties) => (
    <div style={{ ...style, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
      {splitSlots(text).map((seg, i) =>
        seg.literal != null
          ? <span key={i}>{seg.literal}</span>
          : <SlotValue key={i} mapped={lines[(seg.slot ?? 1) - 1] ?? ''} samples={samples} n={seg.slot ?? 1} />)}
    </div>
  )
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {t('wa.preview')}
      </div>
      {/* WhatsApp-ish message bubble, theme-aware */}
      <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: '10px 10px 10px 2px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {header && renderText(header, headerLines, { fontSize: 12, fontWeight: 700, color: 'var(--text)' })}
        {body && renderText(body, bodyLines, { fontSize: 12, color: 'var(--text)' })}
        {footer && <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{footer}</div>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{t('wa.previewHint')}</div>
    </div>
  )
}

// ── The config-panel field ───────────────────────────────────────────────────────

export default function WhatsappTemplateField({ value, onChange, config, variables }: {
  value?: unknown
  onChange: OnChange
  config?: Record<string, unknown>
  variables: WorkflowVarGroup[]
}) {
  const { t } = useTranslation('workflows')
  const [templates, setTemplates] = useState<WaTemplateOption[]>([])
  const [loading, setLoading] = useState(true)

  // Load the tenant's approved templates once (components drive the mapping UI).
  useEffect(() => {
    let alive = true
    import('@/lib/api').then(m => m.default.get('/whatsapp-templates'))
      .then(r => { if (alive) setTemplates((unwrapList(r).rows) as WaTemplateOption[]) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const selected = templates.find(tpl => tpl.value === String(value ?? ''))
  const texts = templateTexts(selected?.components)
  const headerSlots = slotCount(texts.header)
  const bodySlots = slotCount(texts.body)
  const headerLines = toLines(config?.header_variables)
  const bodyLines = toLines(config?.variables)

  // Field-path → sample value from the upstream modules' last run/test output;
  // later groups (nearer ancestors) win when field names collide.
  const samples = useMemo(() => {
    const map: Record<string, string> = {}
    for (const g of variables) for (const f of g.fields) if (f.sample != null && f.label) map[f.label] = f.sample
    return map
  }, [variables])

  // Pick the template; its language flows into the existing `language` config key.
  const pick = (name: string) => {
    onChange('template_name', name)
    const tpl = templates.find(x => x.value === name)
    if (tpl?.language) onChange('language', tpl.language)
  }

  // One slot input: writes line N of the one-value-per-line config string.
  const slotRow = (kind: 'header_variables' | 'variables', lines: string[], slots: number, i: number) => (
    <div key={`${kind}${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden style={{ ...chipStyle, flexShrink: 0, background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>{'{{'}{i + 1}{'}}'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TextFieldWithVars
          field={{ key: kind, label: t('wa.slotLabel', { n: i + 1 }), placeholder: '{{veldnaam}} of vaste tekst' }}
          value={lines[i] ?? ''} variables={variables}
          onChange={(_, v) => onChange(kind, setLine(lines, i, String(v ?? ''), slots))} />
      </div>
    </div>
  )

  // Fallback: unknown template (or no components) → the raw one-per-line textareas.
  const rawFallback = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {String(value ?? '') !== '' && !loading && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('wa.templateUnknown')}</div>
      )}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('wa.headerVarsRaw')}</div>
        <TextFieldWithVars field={{ key: 'header_variables', label: t('wa.headerVarsRaw'), placeholder: '{{header_nl}}' }}
          value={(config?.header_variables as string) ?? ''} variables={variables} multiline
          onChange={onChange} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('wa.bodyVarsRaw')}</div>
        <TextFieldWithVars field={{ key: 'variables', label: t('wa.bodyVarsRaw'), placeholder: '{{firstname}}\n{{datum_nl}}' }}
          value={(config?.variables as string) ?? ''} variables={variables} multiline
          onChange={onChange} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Template select (approved templates only) */}
      {loading
        ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('wa.templateLoading')}</div>
        : (
          <select value={String(value ?? '')} onChange={e => pick(e.target.value)} aria-label={t('wa.template')}
            style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
            <option value="">{t('fields.selectPlaceholder')}</option>
            {templates.map(tpl => <option key={tpl.value} value={tpl.value}>{tpl.label}</option>)}
          </select>
        )}
      {!loading && templates.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('wa.templateEmpty')}</div>
      )}

      {selected && (texts.header || texts.body) ? (
        <>
          {/* Filled-in preview: the message as the candidate receives it */}
          <TemplatePreview header={texts.header} body={texts.body} footer={texts.footer}
            headerLines={headerLines} bodyLines={bodyLines} samples={samples} />

          {/* One mapping row per {{n}} slot, header first (Graph component order) */}
          {headerSlots > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('wa.headerVars')}</div>
              {Array.from({ length: headerSlots }, (_, i) => slotRow('header_variables', headerLines, headerSlots, i))}
            </div>
          )}
          {bodySlots > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('wa.bodyVars')}</div>
              {Array.from({ length: bodySlots }, (_, i) => slotRow('variables', bodyLines, bodySlots, i))}
            </div>
          )}
        </>
      ) : rawFallback}
    </div>
  )
}
