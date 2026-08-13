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

const channels = [
  { value: 'career', label: 'Career page', published: false },
  { value: 'indeed', label: 'Indeed', published: false },
]

describe('PublicationCard · S-selectall-1 select-all above the channel list', () => {
  it('flips every visible channel on, one onToggleChannel call per channel', async () => {
    const onToggleChannel = vi.fn()
    const user = userEvent.setup()
    render(<PublicationCard published={false} onPublishedChange={vi.fn()}
      channels={channels} onToggleChannel={onToggleChannel}
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
    render(<PublicationCard published={false} onPublishedChange={vi.fn()}
      channels={allOn} onToggleChannel={onToggleChannel}
      applicationSettings={{}} onSettingChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: new RegExp(t('multiSelect.clearVisible'), 'i') }))

    expect(onToggleChannel).toHaveBeenCalledWith('career', false)
    expect(onToggleChannel).toHaveBeenCalledWith('indeed', false)
  })
})
