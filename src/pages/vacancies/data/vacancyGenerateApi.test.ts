/**
 * vacancyGenerateApi — contract tests (VACGEN-1 fase 1b, §13: assert the REQUEST,
 * not only that a callback fired). Verifies the resolve GET's params, the
 * generate POST's route/body/config, the 404→null soft-read, and that the field/
 * trait builders only send what the vacancy record actually has.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveGenerationProfile, generateVacancyText, buildGenerateFields, buildGenerateTraits } from './vacancyGenerateApi'
import { mapVacancyDetail } from './mapVacancy'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset() })

describe('resolveGenerationProfile', () => {
  it('GETs /vacancy-generation-profiles/resolve with the traits as query params and maps snake_case → camelCase', async () => {
    mockGet.mockResolvedValue({ data: { profile: { id: 'p1', name: 'Zorg — algemeen' }, specificity: 2, matched_dims: ['contract_type', 'industry'] } })
    const result = await resolveGenerationProfile({ contract_type: 'flex', industry: 'Zorg' })

    expect(mockGet).toHaveBeenCalledWith('/vacancy-generation-profiles/resolve',
      expect.objectContaining({ params: { contract_type: 'flex', industry: 'Zorg' }, quiet404: true }))
    expect(result).toEqual({ profileId: 'p1', name: 'Zorg — algemeen', specificity: 2, matchedDims: ['contract_type', 'industry'] })
  })

  it('returns null on a 404 (no generation profile configured at all) instead of throwing', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })
    await expect(resolveGenerationProfile({})).resolves.toBeNull()
  })

  it('rethrows a non-404 failure (a real error, not the expected "nothing to resolve" outcome)', async () => {
    mockGet.mockRejectedValue({ response: { status: 500 } })
    await expect(resolveGenerationProfile({})).rejects.toBeTruthy()
  })
})

describe('generateVacancyText', () => {
  it('POSTs /vacancies/generate with profile_id/base_vacancy_id/fields and a long timeout + quiet 404/503', async () => {
    mockPost.mockResolvedValue({ data: { ok: true, concept: 'Wij zoeken een verpleegkundige…', model: 'claude-x', profile_id: 'p1' } })
    const result = await generateVacancyText({ profileId: 'p1', baseVacancyId: 'v9', fields: { industry: 'Zorg' } })

    expect(mockPost).toHaveBeenCalledWith('/vacancies/generate',
      { profile_id: 'p1', base_vacancy_id: 'v9', fields: { industry: 'Zorg' } },
      expect.objectContaining({ timeout: 60000, quietStatuses: [404, 503] }))
    expect(result).toEqual({ concept: 'Wij zoeken een verpleegkundige…', model: 'claude-x', profileId: 'p1' })
  })

  it('propagates a 503 soft-fail (no AI credit) as a rejected promise for the caller to map to a calm message', async () => {
    mockPost.mockRejectedValue({ response: { status: 503, data: { ok: false, reason: 'no credit' } } })
    await expect(generateVacancyText({ fields: {} })).rejects.toMatchObject({ response: { status: 503 } })
  })
})

describe('buildGenerateTraits / buildGenerateFields', () => {
  it('only includes the traits/fields the vacancy record actually has', () => {
    const v = mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige', contract_types: ['flex'], industry: 'Zorg', function: 'Verpleegkundige', customer_name: 'Yesway Flex' })
    expect(buildGenerateTraits(v)).toEqual({ contract_type: 'flex', function: 'Verpleegkundige', industry: 'Zorg' })
    expect(buildGenerateFields(v)).toEqual({ contract_form: 'flex', industry: 'Zorg', customer_name: 'Yesway Flex' })
  })

  it('omits empty dims instead of sending them as blank strings', () => {
    const v = mapVacancyDetail({ id: 'v1', title: 'Test' })
    expect(buildGenerateTraits(v)).toEqual({})
    expect(buildGenerateFields(v)).toEqual({})
  })
})
