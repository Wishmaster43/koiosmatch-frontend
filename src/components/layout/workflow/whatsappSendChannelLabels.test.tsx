/**
 * whatsappSendChannelLabels.test — CMBE K-193 fase 0 seam gap (round-2 verdict):
 * the 'select' field renders each option through `optionLabel`/`fieldOptions.*`;
 * this asserts the REAL nl-translated label text for every `channel` enum value,
 * so deleting a fieldOptions key would fail here instead of shipping a raw
 * machine code ('waba_coex') to the screen.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { FieldInput } from './fields'
import whatsappSend from '@/modules/whatsapp_send'

describe('FieldInput · channel select renders real nl labels for every enum value', () => {
  it('shows WABA / WABA · lokaal (Coexistence) / WA Web (eigen nummer)', () => {
    const channelField = whatsappSend.schema.find(f => f.key === 'channel')!
    render(
      <I18nextProvider i18n={i18n}>
        <FieldInput field={channelField} value={undefined} onChange={() => {}} />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('WABA')).toBeInTheDocument()
    expect(screen.getByText('WABA · lokaal (Coexistence)')).toBeInTheDocument()
    expect(screen.getByText('WA Web (eigen nummer)')).toBeInTheDocument()
    // None of the raw machine values leak onto the screen unlabelled.
    expect(screen.queryByText('waba_coex')).not.toBeInTheDocument()
    expect(screen.queryByText('wa_web')).not.toBeInTheDocument()
  })
})
