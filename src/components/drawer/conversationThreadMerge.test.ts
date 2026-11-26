/** mergeLandedMessages: a text-template stub is claimed by the rendered landed row (no permanent queued bubble). */
import { describe, it, expect } from 'vitest'
import { mergeLandedMessages } from './conversationThreadMerge'
import type { MessageRow } from './ConversationMessage'

const row = (o: Record<string, unknown>) => o as unknown as MessageRow

describe('mergeLandedMessages', () => {
  it('drops a template stub when a rendered outbound row landed', () => {
    const stub = row({ id: 'pending-1', direction: 'outbound', message_content: 'Hi {{first_name}}', _pendingOutboxId: 1, _viaTextTemplate: true })
    const landed = row({ id: 'm9', direction: 'outbound', message_content: 'Hi Jan' })
    expect(mergeLandedMessages([landed], [stub])).toEqual([landed])
  })

  it('keeps a plain stub whose text has no exact twin', () => {
    const stub = row({ id: 'pending-1', direction: 'outbound', message_content: 'Hi {{first_name}}', _pendingOutboxId: 1 })
    const landed = row({ id: 'm9', direction: 'outbound', message_content: 'Hi Jan' })
    expect(mergeLandedMessages([landed], [stub])).toHaveLength(2)
  })

  it('a template stub never claims an inbound row', () => {
    const stub = row({ id: 'pending-1', direction: 'outbound', message_content: 'Hi {{first_name}}', _pendingOutboxId: 1, _viaTextTemplate: true })
    const inbound = row({ id: 'm9', direction: 'inbound', message_content: 'Hi Jan' })
    expect(mergeLandedMessages([inbound], [stub])).toEqual([inbound, stub])
  })

  it('exact twins are claimed before a template stub takes its fallback row', () => {
    const template = row({ id: 'pending-1', direction: 'outbound', message_content: 'Hi {{first_name}}', _pendingOutboxId: 1, _viaTextTemplate: true })
    const plain = row({ id: 'pending-2', direction: 'outbound', message_content: 'Top!', _pendingOutboxId: 2 })
    // Only the plain stub's twin landed so far: the template stub must stay queued, never take "Top!".
    const landedPlain = row({ id: 'm9', direction: 'outbound', message_content: 'Top!' })
    expect(mergeLandedMessages([landedPlain], [template, plain])).toEqual([landedPlain, template])
  })
})
