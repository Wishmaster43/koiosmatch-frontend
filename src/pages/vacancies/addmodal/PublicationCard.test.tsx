/**
 * PublicationCard — S-selectall-1: alles/niets toggle above the channel list.
 * Mirrors PublishingTab's own select-all coverage — this card is dumb (no
 * persistence of its own, §2), so onToggleChannel is the whole request shape.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import i18n from '@/i18n'
import PublicationCard from './PublicationCard'

const t = (key: string) => i18n.t(key, { ns: 'common' })
const tv = (key: string) => i18n.t(key, { ns: 'vacancies' })

const channels = [
  { value: 'career', label: 'Career page', published: false },
  { value: 'indeed', label: 'Indeed', published: false },
]

describe('PublicationCard · S-selectall-1 select-all above the channel list', () => {
  it('flips every visible channel on, one onToggleChannel call per channel', async () => {
    const onToggleChannel = vi.fn()
    const user = userEvent.setup()
    render(<PublicationCard channels={channels} onToggleChannel={onToggleChannel}
      applicationSettings={{}} onSettingChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('multiSelect.selectVisible'), 'i') }))

    expect(onToggleChannel).toHaveBeenCalledWith('career', true)
    expect(onToggleChannel).toHaveBeenCalledWith('indeed', true)
    expect(onToggleChannel).toHaveBeenCalledTimes(2)
  })

  it('flips to clear-all once every visible channel is already selected', async () => {
    const onToggleChannel = vi.fn()
    const user = userEvent.setup()
    const allOn = channels.map(c => ({ ...c, published: true }))
    render(<PublicationCard channels={allOn} onToggleChannel={onToggleChannel}
      applicationSettings={{}} onSettingChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('multiSelect.clearVisible'), 'i') }))

    expect(onToggleChannel).toHaveBeenCalledWith('career', false)
    expect(onToggleChannel).toHaveBeenCalledWith('indeed', false)
  })
})

// Row 36: an always-on channel renders checked + disabled and never joins select-all.
describe('PublicationCard · locked (always-on) channel', () => {
  it('disables the locked switch and selects only the switchable channels', async () => {
    const onToggleChannel = vi.fn()
    const user = userEvent.setup()
    render(<PublicationCard
      channels={[...channels, { value: 'api', label: 'Partner API', published: true, locked: true }]} onToggleChannel={onToggleChannel}
      applicationSettings={{}} onSettingChange={vi.fn()} />)

    expect(screen.getByRole('switch', { name: 'Partner API' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: new RegExp(t('multiSelect.selectVisible'), 'i') }))
    expect(onToggleChannel).toHaveBeenCalledTimes(2)
    expect(onToggleChannel).not.toHaveBeenCalledWith('api', expect.anything())
  })
})

// §3 no-fake-affordance fix: the master "Gepubliceerd" row has no persistence
// path of its own (O-25: server-derived from `channels`, ignored on write) —
// it is now a plain read-out, never an editable control with nothing behind it.
describe('PublicationCard · derived published read-out (§3 no-fake-affordance)', () => {
  it('renders no switch for the master published row', () => {
    render(<PublicationCard channels={channels} onToggleChannel={vi.fn()}
      applicationSettings={{}} onSettingChange={vi.fn()} />)
    expect(screen.queryByRole('switch', { name: tv('columns.published') })).not.toBeInTheDocument()
  })

  it('reads "yes" once at least one channel is published, "no" when none are', () => {
    // The value's own data-testid: `publishedState.yes` shares its Dutch text
    // ("Gepubliceerd") with the row's own label AND `columns.published`, so a
    // text query would find multiple matches.
    const { rerender } = render(<PublicationCard channels={channels} onToggleChannel={vi.fn()}
      applicationSettings={{}} onSettingChange={vi.fn()} />)
    expect(screen.getByTestId('publication-master-state')).toHaveTextContent(tv('publishedState.no'))

    const oneOn = channels.map((c, i) => (i === 0 ? { ...c, published: true } : c))
    rerender(<PublicationCard channels={oneOn} onToggleChannel={vi.fn()}
      applicationSettings={{}} onSettingChange={vi.fn()} />)
    expect(screen.getByTestId('publication-master-state')).toHaveTextContent(tv('publishedState.yes'))
  })
})
