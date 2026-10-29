/**
 * whatsapp_inbound source option labels render translated through fields.tsx with a real i18n instance.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { FieldInput } from '@/components/layout/workflow/fields'
import whatsappInbound from './whatsapp_inbound'

afterEach(async () => { await i18n.changeLanguage('nl') })

describe('whatsapp_inbound source option labels', () => {
  const field = whatsappInbound.schema.find(s => s.key === 'source')!

  it.each([
    ['en', 'WhatsApp Web (own number)'],
    ['nl', 'WhatsApp Web (eigen nummer)'],
  ])('renders the wa_web option in %s', async (lng, text) => {
    await i18n.changeLanguage(lng)
    render(
      <I18nextProvider i18n={i18n}>
        <FieldInput field={field} value={undefined} onChange={() => {}} />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText(text)).toBeInTheDocument()
  })
})
