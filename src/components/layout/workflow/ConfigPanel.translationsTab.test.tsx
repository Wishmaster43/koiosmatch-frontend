/**
 * ConfigPanel.translationsTab.test — 02-09: the "Vertalingen" tab appears only
 * for modules whose schema declares a translations-tab field (whatsapp_send/
 * email_send today), never on the main settings tab, and its content renders
 * the per-language blocks. Real i18n is not initialized here (mirrors
 * configPanelWaWeb.test.tsx), so `t()` returns the raw key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

describe('ConfigPanel · translations tab', () => {
  it('shows the Vertalingen tab for a whatsapp_send node', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('config.tabTranslations')).toBeInTheDocument()
  })

  it('does not show the Vertalingen tab for a module without the field (condition)', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'condition', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('config.tabTranslations')).not.toBeInTheDocument()
  })

  it('does not render the translations field label on the main settings tab', () => {
    // fieldLabel() passes a `defaultValue`, so with no i18n instance t() resolves
    // to the raw label "Vertalingen" (not the key "fieldLabels.Vertalingen") —
    // assert on that literal or the guard is vacuous (it would still pass with
    // the translations field leaking onto Settings via a bare label lookup).
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Vertalingen', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('clicking the translations tab renders the per-language blocks', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: {} } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabTranslations'))
    expect(screen.getByText('translations.languages.nl')).toBeInTheDocument()
  })
})
