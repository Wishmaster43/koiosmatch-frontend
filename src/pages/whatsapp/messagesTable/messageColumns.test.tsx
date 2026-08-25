/**
 * useMessageColumns — WA-MSG-TABLE-2 (K-194): every column rendered from the
 * exact WhatsappDashboardController::messages() wire shape (candidate-owned and
 * customer_contact-owned rows, a null message_type, a failed status with
 * failure_reason). Covers both CEL-DOORKLIK-CANON gateways' exact openEntity
 * args, the type/template chip onFilter args, and that both stay inert (no
 * role/cursor/tabIndex) without an onFilter.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable from '@/components/ui/DataTable'
import { useMessageColumns, type MessageFilterPatch } from './messageColumns'
import type { WaMessage } from '@/types/whatsapp'

// Pass-through t (keys, not translated prose) — this file asserts wire-shape
// behaviour, not i18n copy (covered by localeParity.test.ts / keysExist.test.ts).
// Pass-through t() that still honours `defaultValue` like the real i18next
// does for an unseeded key — needed to assert the humanized purpose fallback.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => k.includes('smb_app_echo') && opts?.defaultValue ? opts.defaultValue : k }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDateTime: (v?: string) => v ? `dt:${v}` : '' }) }))

const mockOpenEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity }) }))

// Small harness: renders the shared column config through the real DataTable,
// the exact composition MessagesTable/WhatsAppLog both use.
function Harness({ messages, onFilter }: { messages: WaMessage[]; onFilter?: (patch: MessageFilterPatch) => void }) {
  const columns = useMessageColumns({ onFilter })
  return <DataTable<WaMessage> columns={columns} rows={messages} getRowId={m => m.id ?? ''} />
}

const candidateRow: WaMessage = {
  id: 'm-1', conversation_id: 'conv-1', candidate_id: 'c-1', candidate: { first_name: 'Jan', last_name: 'Jansen' },
  direction: 'inbound', status: 'read', body: 'Hallo', sent_at: '2026-08-25T14:30:00Z',
  wa_number_masked: '+31 6 **** 12',
  channel: 'waba', channel_label: 'WABA',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture: a tenant message-type colour from the server, not a UI colour choice
  message_type: { id: 'mt-1', value: 'reminder', label: 'Herinnering', color: '#0EA5E9', is_priority: true },
  purpose: 'birthday', template_name: 'birthday_v1',
  sent_by_user: { id: 'u-1', name: 'Ravi' },
}

const contactRow: WaMessage = {
  id: 'm-2', conversation_id: 'conv-2', candidate_id: null,
  customer_contact: { id: 'ct-1', first_name: 'Marieke', last_name: 'de Vries', customer_id: 'cust-9' },
  direction: 'outbound', status: 'sent', body: 'Systeembericht', sent_at: '2026-08-25T09:00:00Z',
}

const failedRow: WaMessage = {
  id: 'm-3', candidate_id: 'c-2', candidate: { first_name: 'Piet', last_name: 'Bakker' },
  direction: 'outbound', status: 'failed', failed_at: '2026-08-25T10:00:00Z', failure_reason: 'Number opted out',
  body: 'Mislukt bericht', sent_at: '2026-08-25T09:55:00Z', message_type: null,
}

describe('useMessageColumns · wire shape (WA-MSG-TABLE-2)', () => {
  it('recipient: the full number wins over the masked one when the server sends it (K-197 candidates.view)', () => {
    render(<Harness messages={[{ ...candidateRow, wa_number: '+31 6 1234 5612' }]} />)
    expect(screen.getByText('+31 6 1234 5612')).toBeInTheDocument()
    expect(screen.queryByText('+31 6 **** 12')).not.toBeInTheDocument()
  })

  it('recipient: without the full number the masked form renders (no candidates.view)', () => {
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('+31 6 **** 12')).toBeInTheDocument()
  })

  it('recipient: the full number wins over the masked one when the server sends it (K-197 candidates.view)', () => {
    render(<Harness messages={[{ ...candidateRow, wa_number: '+31 6 1234 5612' }]} />)
    expect(screen.getByText('+31 6 1234 5612')).toBeInTheDocument()
    expect(screen.queryByText('+31 6 **** 12')).not.toBeInTheDocument()
  })

  it('recipient: without the full number the masked form renders (no candidates.view)', () => {
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('+31 6 **** 12')).toBeInTheDocument()
  })

  it('recipient: candidate-owned row links to the candidate drilldown', async () => {
    const user = userEvent.setup()
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('+31 6 **** 12')).toBeInTheDocument()
    await user.click(screen.getByText('Jan Jansen'))
    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'c-1')
  })

  it('recipient: customer_contact-owned row links to the customer drilldown Contacts tab', async () => {
    const user = userEvent.setup()
    render(<Harness messages={[contactRow]} />)
    expect(screen.getByText('Marieke de Vries')).toBeInTheDocument()
    await user.click(screen.getByText('Marieke de Vries'))
    expect(mockOpenEntity).toHaveBeenCalledWith('customers', 'cust-9', 'contacts')
  })

  it('conversation gateway: candidate-owned row opens communication:conversations', async () => {
    const user = userEvent.setup()
    render(<Harness messages={[candidateRow]} />)
    await user.click(screen.getByRole('button', { name: 'messages.openConversation' }))
    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'c-1', 'communication:conversations')
  })

  it('conversation gateway: customer_contact-owned row opens the customer communication tab', async () => {
    const user = userEvent.setup()
    render(<Harness messages={[contactRow]} />)
    await user.click(screen.getByRole('button', { name: 'messages.openConversation' }))
    expect(mockOpenEntity).toHaveBeenCalledWith('customers', 'cust-9', 'communication')
  })

  it('renders the type chip + priority marker for a row with a message_type', () => {
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('Herinnering')).toBeInTheDocument()
    expect(screen.getByText('messages.priority')).toBeInTheDocument()
  })

  it('a null message_type renders no type chip and no priority marker', () => {
    render(<Harness messages={[failedRow]} />)
    expect(screen.queryByText('Herinnering')).not.toBeInTheDocument()
    expect(screen.queryByText('messages.priority')).not.toBeInTheDocument()
  })

  it('sent_at renders through the shared date formatter (Mono)', () => {
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('dt:2026-08-25T14:30:00Z')).toBeInTheDocument()
  })

  it('channel renders a chip with its token colour when the channel is known', () => {
    render(<Harness messages={[candidateRow]} />)
    expect(screen.getByText('conversations.channel.waba')).toBeInTheDocument()
  })

  it('channel renders no chip when the channel is unknown and there is no server label', () => {
    render(<Harness messages={[contactRow]} />)
    expect(screen.queryByText(/conversations\.channel\./)).not.toBeInTheDocument()
  })

  it('purpose renders the translated key when it exists, humanized fallback when it does not', () => {
    const unseeded: WaMessage = { ...candidateRow, id: 'm-4', purpose: 'smb_app_echo' }
    render(<Harness messages={[candidateRow, unseeded]} />)
    // Pass-through t() returns the key itself for a seeded purpose (mocked above).
    expect(screen.getByText('candidates:conversations.purpose.birthday')).toBeInTheDocument()
    // An unseeded purpose falls back to the humanized slug, never the raw one.
    expect(screen.getByText('Smb app echo')).toBeInTheDocument()
    expect(screen.queryByText('smb_app_echo')).not.toBeInTheDocument()
  })

  it('sentBy shows the sending user, or "automatic" when sent_by_user is absent', () => {
    render(<Harness messages={[candidateRow, contactRow]} />)
    expect(screen.getByText('Ravi')).toBeInTheDocument()
    expect(screen.getByText('messages.automatic')).toBeInTheDocument()
  })

  it('the status chip carries a translated label and a tooltip with failed_at + failure_reason', () => {
    render(<Harness messages={[failedRow]} />)
    const chip = screen.getByText('msgStatus.failed')
    expect(chip).toHaveAttribute('title', expect.stringContaining('Number opted out'))
  })

  it('the type chip calls onFilter with the message_type id when wired', async () => {
    const user = userEvent.setup()
    const onFilter = vi.fn()
    render(<Harness messages={[candidateRow]} onFilter={onFilter} />)
    await user.click(screen.getByText('Herinnering'))
    expect(onFilter).toHaveBeenCalledWith({ type: 'mt-1' })
  })

  it('the template cell calls onFilter with the template name when wired', async () => {
    const user = userEvent.setup()
    const onFilter = vi.fn()
    render(<Harness messages={[candidateRow]} onFilter={onFilter} />)
    await user.click(screen.getByText('birthday_v1'))
    expect(onFilter).toHaveBeenCalledWith({ template: 'birthday_v1' })
  })

  it('the type and template chips stay inert (no role/tabIndex) without onFilter', () => {
    render(<Harness messages={[candidateRow]} />)
    // The wrapper span carries the interactive() props, one level above the
    // SoftChip/Mono span that renders the visible text.
    const typeWrapper = screen.getByText('Herinnering').parentElement
    expect(typeWrapper).not.toHaveAttribute('role')
    expect(typeWrapper).not.toHaveAttribute('tabindex')
    const templateWrapper = screen.getByText('birthday_v1').parentElement
    expect(templateWrapper).not.toHaveAttribute('role')
    expect(templateWrapper).not.toHaveAttribute('tabindex')
  })
})
