/**
 * WaMessageTypeSettings — the /whatsapp-message-types editor is the ONE StatusListEditor
 * caller that must show `showRank`: its sort_order drives WhatsAppSendModule's queue
 * priority split (koiosmatch-api app/Workflow/Modules/WhatsAppSendModule.php:260-276),
 * so the rank number is real "1 = sent first" semantics, not decoration. This regression-
 * guards the 2026-07-10 extraction (ee207f18) that recreated the editor without it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import { WaMessageTypeSettings } from './WaMessageTypeSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture type's tenant-picked colour, not a style rule.
const type = (over = {}) => ({ id: 'm1', name: 'Sollicitatie', color: '#3B8FD4', ...over })

afterEach(() => { vi.clearAllMocks() })

describe('WaMessageTypeSettings — priority rank input', () => {
  it('renders the typed-rank input per row so the send-priority order is explicit', async () => {
    api.get.mockResolvedValue({
      data: [type({ id: 'm1', name: 'Sollicitatie' }), type({ id: 'm2', name: 'Match' })],
    })
    render(<WaMessageTypeSettings />)

    await screen.findByText('Match')
    // showRank renders a number input titled/labelled with the priority-rank copy.
    const rankInputs = screen.getAllByTitle(st('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' }))
    expect(rankInputs).toHaveLength(2)
    expect(rankInputs[0]).toHaveValue(1)
    expect(rankInputs[1]).toHaveValue(2)
  })
})
