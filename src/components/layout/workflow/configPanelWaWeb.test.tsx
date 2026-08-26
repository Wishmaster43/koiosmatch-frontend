/**
 * configPanelWaWeb.test — K-193 fase 2b (C): picking 'wa_web' on whatsapp_send's
 * channel field auto-sets message_type to 'session' (the only format WhatsApp
 * Web can send), never silently — a Caption notice explains why — and the step
 * output renders its whatsapp_queued counter. Real i18n is not initialized here
 * (mirrors configPanelRequired.test.tsx), so `t()` returns the raw key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

// The channel field renders through CreatableSelect (searchable dropdown); no
// network options needed since 'channel' is a static select, not a lookup.
// Its own field block is located via its visible label ("Kanaal", fieldLabel's
// defaultValue fallback with no i18n provider) rather than button order, since
// several other fields on this schema also render a CreatableSelect trigger.
function openChannelSelect() {
  // Both the visible <label> and the sr-only span carry the same fallback text
  // ("Kanaal") — scope to the visible <label> so the query is unambiguous.
  const wrapper = screen.getByText('Kanaal', { selector: 'label' }).closest('div')!
  fireEvent.click(within(wrapper).getByRole('button'))
}

describe('ConfigPanel · whatsapp_send legacy config (no stored channel)', () => {
  it('still shows the Afzender (phone_number_id) field for an unset legacy channel', () => {
    // The backend defaults a missing `channel` to 'waba' and still requires
    // phone_number_id there; the builder must not hide an already-stored sender.
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { phone_number_id: 'p1' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Afzender', { selector: 'label' })).toBeInTheDocument()
  })
})

describe('ConfigPanel · whatsapp_send wa_web channel branch', () => {
  it('picking wa_web writes message_type "session" into the node config', async () => {
    const onUpdate = vi.fn()
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'template' } } }
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    // Open the channel select and choose "wa_web" (raw enum value, i18n unmocked).
    openChannelSelect()
    const opt = await screen.findByText('wa_web')
    fireEvent.click(opt)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('n1', 'channel', 'wa_web'))
    expect(onUpdate).toHaveBeenCalledWith('n1', 'message_type', 'session')
  })

  it('does not overwrite message_type when it is already "session"', async () => {
    const onUpdate = vi.fn()
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { message_type: 'session' } } }
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    openChannelSelect()
    const opt = await screen.findByText('wa_web')
    fireEvent.click(opt)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('n1', 'channel', 'wa_web'))
    expect(onUpdate).not.toHaveBeenCalledWith('n1', 'message_type', 'session')
  })

  it('shows the wa_web session-only notice under message_type when channel is wa_web', () => {
    const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'whatsapp_send', config: { channel: 'wa_web', message_type: 'session' } } }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('fields.waWebSessionOnly')).toBeInTheDocument()
  })

  it('renders the whatsapp_queued output counter', async () => {
    const node: FlowNode = {
      id: 'n1', position: { x: 0, y: 0 },
      data: { type: 'whatsapp_send', config: { channel: 'wa_web' }, output: { whatsapp_queued: 4 } },
    }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabExecution (1)'))
    expect(screen.getByText('fields.whatsappQueued')).toBeInTheDocument()
  })

  it('does NOT render the whatsapp_queued line for a WABA fan-out (same key, other channel)', () => {
    // WhatsAppFanoutProgress mirrors `whatsapp_queued` onto every WABA/waba_coex
    // fan-out output too — the line must only ever name WhatsApp Web.
    const node: FlowNode = {
      id: 'n1', position: { x: 0, y: 0 },
      data: { type: 'whatsapp_send', config: { channel: 'waba' }, output: { whatsapp_fanout: { total: 4, sent: 4 }, whatsapp_queued: 4 } },
    }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabExecution (1)'))
    expect(screen.queryByText('fields.whatsappQueued')).not.toBeInTheDocument()
  })

  it('does not render the whatsapp_queued line for a zero count', () => {
    const node: FlowNode = {
      id: 'n1', position: { x: 0, y: 0 },
      data: { type: 'whatsapp_send', config: { channel: 'wa_web' }, output: { whatsapp_queued: 0 } },
    }
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabExecution (1)'))
    expect(screen.queryByText('fields.whatsappQueued')).not.toBeInTheDocument()
  })
})
