/**
 * noteMetaSentence — pure sentence-builder tests (K-225 NOTE-META-1). The stub `t`
 * echoes `key|{json of options}` so each assertion can check both the key picked
 * (statusChange vs statusSet, which suffixes fired) and the exact values passed in,
 * without depending on any real locale bundle.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { noteMetaSentence } from './noteMetaSentence'
import type { NoteMeta, NoteMetaContext } from './noteMetaSentence'

// Echoes 'key|{"opt":"val"}' so a test can assert the key AND the interpolation values
// without a real i18next instance or locale bundle.
const t = ((key: string, opts?: Record<string, unknown>) => `${key}|${JSON.stringify(opts ?? {})}`) as unknown as TFunction

// Uppercases the slug so a test can tell "resolved via lookup" apart from "raw slug
// fell through unresolved".
const statusLabel = (value: string) => `LABEL(${value})`

// House DD-MM-YYYY stand-in — proves the builder calls the caller's formatter rather
// than rendering the raw ISO string itself.
const formatDate = (iso: string) => `FMT(${iso})`

// Same shape as statusLabel, for the phase_change tenant lookup resolver.
const phaseLabel = (value: string) => `PHASE(${value})`

const ctx: NoteMetaContext = { t, statusLabel, phaseLabel, formatDate }

describe('noteMetaSentence', () => {
  it('joins statusChange with reason, blacklist reason and effective date', () => {
    const meta: NoteMeta = {
      kind: 'status_change',
      from_value: 'available',
      to_value: 'blacklist',
      reason_value: 'No-show',
      blacklist_reason_value: 'Fraud',
      effective_from: '2026-09-01',
    }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe(
      'notes.meta.statusChange|{"from":"LABEL(available)","to":"LABEL(blacklist)"}'
      + 'notes.meta.reason|{"reason":"No-show"}'
      + 'notes.meta.blacklistReason|{"reason":"Fraud"}'
      + 'notes.meta.effectiveFrom|{"date":"FMT(2026-09-01)"}',
    )
  })

  it('falls back to statusSet when from_value is missing', () => {
    const meta: NoteMeta = { kind: 'status_change', from_value: null, to_value: 'available' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.statusSet|{"to":"LABEL(available)"}')
  })

  it('omits every suffix when reason/blacklist reason/effective date are absent', () => {
    const meta: NoteMeta = { kind: 'status_change', from_value: 'available', to_value: 'placed' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.statusChange|{"from":"LABEL(available)","to":"LABEL(placed)"}')
  })

  it('returns null for an unknown kind', () => {
    const meta = { kind: 'something_else', from_value: 'lead', to_value: 'candidate' } as NoteMeta
    expect(noteMetaSentence(meta, ctx)).toBeNull()
  })

  it('returns null when meta is null or has no kind', () => {
    expect(noteMetaSentence(null, ctx)).toBeNull()
    expect(noteMetaSentence(undefined, ctx)).toBeNull()
    expect(noteMetaSentence({}, ctx)).toBeNull()
  })

  it('falls back to the raw slug when statusLabel does not resolve it', () => {
    const passthrough: NoteMetaContext = { t, statusLabel: (v: string) => v, phaseLabel, formatDate }
    const meta: NoteMeta = { kind: 'status_change', from_value: 'available', to_value: 'unknown_slug' }
    const sentence = noteMetaSentence(meta, passthrough)
    expect(sentence).toBe('notes.meta.statusChange|{"from":"available","to":"unknown_slug"}')
  })

  // K-225 H2: phase_change — mirrors status_change's from/to resolution, but carries
  // no reason/effective-date suffixes per the contract.
  it('joins phaseChange with the resolved phase labels', () => {
    const meta: NoteMeta = { kind: 'phase_change', from_value: 'lead', to_value: 'candidate' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.phaseChange|{"from":"PHASE(lead)","to":"PHASE(candidate)"}')
  })

  it('falls back to phaseSet when from_value is missing', () => {
    const meta: NoteMeta = { kind: 'phase_change', from_value: null, to_value: 'candidate' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.phaseSet|{"to":"PHASE(candidate)"}')
  })

  // K-225 H2: archived — carries the shared reason suffix when reason_value is present.
  it('archived appends the reason suffix when reason_value is present', () => {
    const meta: NoteMeta = { kind: 'archived', reason_value: 'Duplicate profile' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.archived|{}notes.meta.reason|{"reason":"Duplicate profile"}')
  })

  it('archived omits the reason suffix when reason_value is absent', () => {
    const meta: NoteMeta = { kind: 'archived', reason_value: null }
    expect(noteMetaSentence(meta, ctx)).toBe('notes.meta.archived|{}')
  })

  // K-225 H2: restored — the kind carries no optional fields at all.
  it('restored renders the bare sentence', () => {
    const meta: NoteMeta = { kind: 'restored' }
    expect(noteMetaSentence(meta, ctx)).toBe('notes.meta.restored|{}')
  })

  // K-225 H2: marked_for_deletion — its own eraseAt suffix, distinct from effectiveFrom.
  it('markedForDeletion appends the eraseAt suffix when erase_at is present', () => {
    const meta: NoteMeta = { kind: 'marked_for_deletion', erase_at: '2026-10-01' }
    const sentence = noteMetaSentence(meta, ctx)
    expect(sentence).toBe('notes.meta.markedForDeletion|{}notes.meta.eraseAt|{"date":"FMT(2026-10-01)"}')
  })

  it('markedForDeletion omits the suffix when erase_at is null', () => {
    const meta: NoteMeta = { kind: 'marked_for_deletion', erase_at: null }
    expect(noteMetaSentence(meta, ctx)).toBe('notes.meta.markedForDeletion|{}')
  })
})
