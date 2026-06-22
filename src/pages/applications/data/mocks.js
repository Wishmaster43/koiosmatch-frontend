/**
 * Applications mock/demo data — only used as a fallback when USE_MOCKS is on and
 * the API returns nothing (see lib/mocks). Never shipped to production. The shape
 * mirrors mapApplication's output so the page can use it directly.
 *
 * Note: funnel phases and candidate statuses are tenant data (not UI strings), so
 * their labels live here as data — they are not run through i18n.
 */

// Funnel phases are NOT hardcoded here — they come from the tenant funnel lookup
// (LookupsContext.funnelTypes: applied/invited/proposed/hired/rejected). Mock
// applications only carry a phaseKey + bucket; the page resolves label/colour.

// Demo vacancies referenced by the applications below.
export const VACANCIES = [
  { id: 'v1',  title: 'Verzorgende IG - Papendrecht - Ouderzorg (PG) - Flexibel & goed betaald', client: 'Stichting Rivas Zorggroep (Hoofd)' },
  { id: 'v2',  title: 'Helpende Plus – Papendrecht | Dag, Avond & Weekend | Flexibel + bonus',    client: 'Stichting Rivas Zorggroep (Hoofd)' },
  { id: 'v3',  title: 'Persoonlijk begeleider | LVB+ | Den Haag',                                 client: 'Yesway zorg' },
  { id: 'v4',  title: 'Verzorgende IG | Zuid-Holland | DUMMY',                                    client: 'Yesway works' },
  { id: 'v5',  title: 'Helpende (Plus) | Zuid-Holland | DUMMY',                                   client: 'Yesway works' },
  { id: 'v6',  title: 'Helpende Plus in Anna Paulowna',                                           client: 'Stichting WoonzorgGroep Samen' },
  { id: 'v7',  title: 'Helpende (Plus) | Noord-Holland | DUMMY',                                  client: 'Yesway works' },
  { id: 'v8',  title: 'Verzorgende IG – Rotterdam & omgeving | Flexibele diensten + bonus',       client: 'Yesway zorg' },
  { id: 'v9',  title: 'Verzorgende IG PG – Rotterdam & omgeving | Flexibele diensten + bonus',    client: 'Yesway zorg' },
  { id: 'v10', title: 'Verzorgende IG – Revalidatiezorg | Rotterdam Zuid | 20–32 uur',            client: 'Yesway' },
  { id: 'v11', title: 'Verzorgende IG | Begeleider - EMB – Rotterdam',                            client: 'Yesway zorg' },
]

// Raw demo applications (faithful to the original prototype data).
const RAW = [
  { id: 1,  name: 'Ismail Eddahchouri',     vacancyId: 'v1',  score: null, task: 'Beoordeel de sollicitatie en plan een kennismakingsgesprek', phase: 'applied',  source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '12 jun 2026', isNew: true  },
  { id: 2,  name: 'Merel Van Muijlwijk',    vacancyId: 'v2',  score: null, task: 'Nodig de kandidaat uit voor een kennismakingsgesprek',       phase: 'applied',  source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '12 jun 2026', isNew: true  },
  { id: 3,  name: 'Elif Akagündüz',         vacancyId: 'v3',  score: null, task: 'Beoordeel of Elif uitgenodigd kan worden voor gesprek',       phase: 'applied',  source: 'Werkzoeken',    owner: 'Kelly van Vliet',   status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '12 jun 2026', isNew: false },
  { id: 4,  name: 'Figen Ooijevaar',        vacancyId: 'v4',  score: 78,   task: 'Plan een kennismakingsgesprek met Figen',                    phase: 'applied',  source: 'Yesway Import', owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '11 jun 2026', isNew: false },
  { id: 5,  name: 'Fernanda Vogel-Andrade', vacancyId: 'v4',  score: 78,   task: 'Bel Fernanda volgende week voor haar vakantie op',           phase: 'invited',  source: 'Yesway Import', owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '11 jun 2026', isNew: false },
  { id: 6,  name: 'Rubina Rosella Milan',   vacancyId: 'v6',  score: 65,   task: 'Kandidaat is uitgenodigd; beoordeel de match voor de vervolgstap', phase: 'invited', source: 'Werkzoeken', owner: 'Kelly van Vliet',   status: 'Intake gepland',  statusColor: 'var(--color-secondary)', created: '11 jun 2026', isNew: true  },
  { id: 7,  name: 'Priscilla Benjamin',     vacancyId: 'v5',  score: 68,   task: 'Plan intakegesprek voor Priscilla',                          phase: 'applied',  source: 'Yesway Import', owner: 'Bente de Jong',     status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '11 jun 2026', isNew: false },
  { id: 8,  name: 'Petra Kuiters',          vacancyId: 'v5',  score: 67,   task: 'Beoordeel kandidaat voor de volgende stap',                  phase: 'applied',  source: 'Yesway Import', owner: 'Bente de Jong',     status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '11 jun 2026', isNew: false },
  { id: 9,  name: 'Fenicia Uiterloo',       vacancyId: 'v4',  score: 78,   task: 'Beoordeel de match en nodig kandidaat uit',                  phase: 'applied',  source: 'Yesway Import', owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '11 jun 2026', isNew: false },
  { id: 10, name: 'Felicia Meijer',         vacancyId: 'v4',  score: 78,   task: 'Beoordeel kandidaat voor uitnodiging',                       phase: 'applied',  source: 'Yesway Import', owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '11 jun 2026', isNew: false },
  { id: 11, name: 'Shemion Kuwas',          vacancyId: 'v9',  score: 35,   task: 'Beoordeel kandidaat voor de volgende stap',                  phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '8 jun 2026',  isNew: true  },
  { id: 12, name: 'Monica Vogel',           vacancyId: 'v5',  score: 70,   task: 'Nodig kandidaat uit voor gesprek',                           phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '8 jun 2026',  isNew: false },
  { id: 13, name: 'Esther Boer',            vacancyId: 'v4',  score: 78,   task: 'Nodig de kandidaat uit voor een kennismakingsgesprek',       phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '8 jun 2026',  isNew: false },
  { id: 14, name: 'Emi Soliano',            vacancyId: 'v7',  score: 100,  task: 'Evalueer sollicitatie voor vervolgstap',                     phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '8 jun 2026',  isNew: false },
  { id: 15, name: 'Marish Tewari',          vacancyId: 'v5',  score: 55,   task: 'Stuur kandidaat een uitnodiging voor een kennismaking',      phase: 'invited',  source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '11 jun 2026', isNew: false },
  { id: 16, name: 'Nema Kamwanda',          vacancyId: 'v4',  score: 81,   task: 'Plan gesprek met Nema',                                      phase: 'invited',  source: 'Werkzoeken',    owner: 'Bente de Jong',     status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '11 jun 2026', isNew: true  },
  { id: 17, name: 'Nadia Tahtah',           vacancyId: 'v11', score: 82,   task: 'Nodig Nadia uit voor een kennismakingsgesprek',              phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '7 jun 2026',  isNew: true  },
  { id: 18, name: 'Manike Basnayaka',       vacancyId: 'v5',  score: 72,   task: 'Stuur kandidaat een uitnodiging voor gesprek',               phase: 'proposed', source: 'Werkzoeken',    owner: 'Bente de Jong',     status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '5 jun 2026',  isNew: false },
  { id: 19, name: 'Chantal Wagemakers',     vacancyId: 'v10', score: 72,   task: 'Plan een kennismakingsgesprek met Chantal',                  phase: 'proposed', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '2 jun 2026',  isNew: true  },
  { id: 20, name: 'Genevieve Nyanda',       vacancyId: 'v5',  score: 50,   task: 'Bevestig afwijzing wegens geen interesse',                   phase: 'rejected', source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '26 mei 2026', isNew: false },
  { id: 21, name: 'Joehna Hous',            vacancyId: 'v4',  score: 73,   task: 'Plan gesprek met Joehna',                                    phase: 'proposed', source: 'Werkzoeken',    owner: 'Kelly van Vliet',   status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '4 jun 2026',  isNew: false },
  { id: 22, name: 'Amara Diallo',           vacancyId: 'v8',  score: 61,   task: 'Beoordeel de sollicitatie',                                  phase: 'applied',  source: 'Werkzoeken',    owner: 'Kelly van Vliet',   status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '10 jun 2026', isNew: false },
  { id: 23, name: 'Rosa Tijssen',           vacancyId: 'v5',  score: 84,   task: 'Nodig Rosa uit voor gesprek',                                phase: 'hired',    source: 'Yesway Import', owner: 'Bente de Jong',     status: 'Nieuwe kandidaat', statusColor: 'var(--color-primary)',   created: '7 jun 2026',  isNew: false },
  { id: 24, name: 'Layla Mansour',          vacancyId: 'v3',  score: 77,   task: 'Beoordeel sollicitatie Layla',                               phase: 'applied',  source: 'Werkzoeken',    owner: 'Kelly van Vliet',   status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '11 jun 2026', isNew: false },
  { id: 25, name: 'Yara Fontein',           vacancyId: 'v1',  score: 69,   task: 'Plan kennismakingsgesprek Yara',                             phase: 'hired',    source: 'Werkzoeken',    owner: 'Wiktoria Opalenyk', status: 'Beschikbaar',     statusColor: 'var(--color-success)',   created: '10 jun 2026', isNew: false },
]

// Two-letter initials from a person's name, e.g. "Bente de Jong" → "BJ".
const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// The three list buckets are derived from the phase key: hired = matched,
// rejected = rejected, everything else = active.
export const bucketOfPhase = (key) =>
  key === 'rejected' ? 'rejected' : key === 'hired' ? 'matched' : 'active'

// Final flat applications. Phase label/colour are resolved at render time from the
// funnel lookup (the page decorates), so the mock only carries phaseKey + bucket.
export const MOCK_APPLICATIONS = RAW.map(r => {
  const vac = VACANCIES.find(v => v.id === r.vacancyId)
  return {
    id: r.id,
    candidateId: `c-${r.id}`,
    candidateName: r.name,
    candidateInitials: initialsOf(r.name),
    vacancyId: r.vacancyId,
    vacancyTitle: vac?.title ?? '—',
    client: vac?.client ?? '—',
    score: r.score,
    task: r.task,
    phaseKey: r.phase,
    bucket: bucketOfPhase(r.phase),
    source: r.source,
    owner: { name: r.owner, initials: initialsOf(r.owner) },
    candidateStatusLabel: r.status,
    candidateStatusColor: r.statusColor,
    created: r.created,
    isNew: r.isNew,
  }
})

// A short demo WhatsApp transcript (out = recruiter, in = candidate).
const mockTranscript = (firstName) => [
  { author: 'Jaicob',   side: 'out', time: '17:37', text: `Hoi ${firstName}! 😊 Ik ben Wiktoria, recruiter bij Yesway. Heb je 2 minuutjes voor een paar korte vragen?` },
  { author: firstName,  side: 'in',  time: '19:08', text: 'Ik heb een vaste baan 😉' },
  { author: 'Jaicob',   side: 'out', time: '19:08', text: 'Bedankt voor je reactie! Werk je op dit moment in de zorg, of heb je dat recent gedaan?' },
  { author: firstName,  side: 'in',  time: '19:09', text: 'Ik werk in de zorg' },
  { author: 'Jaicob',   side: 'out', time: '19:10', text: 'Goed om te horen dat je actief bent in de zorg! Sta je open voor een vrijblijvend gesprek over flexibel werken?' },
]

// Standard scoring dimensions, scored around the application's overall score.
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))
const mockCriteria = (score) => [
  { key: 'qualifications', label: 'Kwalificaties',        score: clamp(score + 7), weight: 25, hard: true,  note: 'Ervaring als Verzorgende IG sluit aan op de vacature-eisen.' },
  { key: 'culture',        label: 'Culturele afstemming', score: clamp(score - 3), weight: 15, hard: false, note: 'Waardeert afwisseling en eigen regie; past bij Yesway.' },
  { key: 'ambition',       label: 'Carrière-ambities',    score: clamp(score - 8), weight: 10, hard: false, note: 'Zoekt balans; nog onzeker over exacte vorm (vast/flex).' },
  { key: 'technical',      label: 'Technische pasvorm',   score: clamp(score + 2), weight: 20, hard: false, note: 'Vereiste verpleegtechnische handelingen aanwezig.' },
  { key: 'soft_skills',    label: 'Soft skills',          score: clamp(score - 3), weight: 15, hard: false, note: 'Communicatief sterk en empathisch.' },
  { key: 'location',       label: 'Locatie',              score: clamp(score + 2), weight: 15, hard: true,  note: 'Binnen acceptabele reisafstand van de standplaats.' },
]

// A small derived activity timeline for an application.
const mockTimeline = (app) => {
  const items = [{ id: 't1', author: app.candidateName, initials: app.candidateInitials,
    description: `Gesolliciteerd op ${app.vacancyTitle}`, ai: true, time: `${app.created} · 17:34` }]
  if (app.phaseKey !== 'applied') {
    items.unshift({ id: 't2', author: app.candidateName, initials: app.candidateInitials,
      description: `Fase gewijzigd naar ${app.phaseLabel}`, ai: false, time: `${app.created} · 19:19` })
  }
  return items
}

/**
 * buildMockDetail — enrich a flat application with the nested detail the drawer
 * tabs render (candidate, vacancy, interviews, appointments, timeline, match).
 * Only used as the USE_MOCKS fallback for GET /applications/{id}.
 */
export function buildMockDetail(app) {
  const firstName = app.candidateName.split(' ')[0]
  return {
    ...app,
    candidate: {
      name: app.candidateName, initials: app.candidateInitials, function: 'Verzorgende IG',
      statusLabel: app.candidateStatusLabel, statusColor: app.candidateStatusColor,
      gender: 'Vrouw', nationality: 'Nederlands', dob: '14 februari 1972 (54 jaar)',
      email: `${firstName.toLowerCase()}@example.com`, phone: '+31 6 40 80 25 05',
      address: 'Zoetermeer', summary: `${app.candidateName} — zorgprofessional met passie voor ouderenzorg.`,
    },
    vacancy: {
      id: app.vacancyId, title: app.vacancyTitle, client: app.client,
      vacancyId: '00087', status: 'Open', employmentType: 'Tijdelijk',
      location: "Laan van 's-Gravenmade 28, 's-Gravenhage", salary: '€ 2.643 – € 3.471 / maand',
      hours: '16–40 uur', experience: '1 jaar', seniority: 'Professional', education: 'MBO',
      branch: 'Gezondheidszorg', category: 'Verpleging',
      skills: ['Ouderenzorg', 'PG', 'Somatiek', 'Rijbewijs B'],
      tags: ['Verzorgende IG', 'VIG', 'flex', 'Zuid-Holland', 'zorg'],
    },
    interviews: app.score != null ? [{
      id: 'i1', channel: 'whatsapp', status: 'done', date: app.created, time: '17:37',
      summary: `Samenvatting van het gesprek met ${firstName}: open voor een vrijblijvend gesprek over mogelijkheden via detachering of uitzenden; nachtdiensten en vijf weken vakantie zijn voor haar belangrijk.`,
      transcript: mockTranscript(firstName),
    }] : [],
    appointments: app.phaseKey === 'invited' ? [{
      id: 'a1', type: 'Intake', title: `Kennismaking met ${firstName}`,
      when: `${app.created}, 10:00`, with: app.owner?.name, status: 'planned',
    }] : [],
    timeline: mockTimeline(app),
    notes: [],
    // Match SCORE (the fit) — flat fields; `score` already holds the overall.
    matchCriteria: app.score != null ? mockCriteria(app.score) : [],
    matchSummary: 'Sterke match op kwalificaties, ervaring en locatie. Goede culturele en technische fit met ruimte voor flexibiliteit.',
    matchSource: 'ai',
    aiScore: app.score,
    // AI advice — only a hard-criterion failure makes auto-reject eligible; the
    // rest is advice the recruiter still has to confirm.
    ai: app.score != null ? {
      advice: app.score < 50 ? 'reject' : app.score >= 75 ? 'proceed' : 'review',
      advice_reason: app.score < 50 ? 'Lage match op kwalificaties en locatie.' : null,
      auto_reject_eligible: false,
      task: app.task,
    } : null,
    // Existing rejection summary (only for already-rejected applications).
    rejection: app.bucket === 'rejected'
      ? { reason_label: 'Kandidaat geen interesse', note: '', channel: 'email', sent_at: app.created }
      : null,
  }
}

// Demo rejection reasons — fallback for /candidate-rejection-reasons under USE_MOCKS.
export const MOCK_REJECTION_REASONS = [
  { id: 'r1', name: 'Niet flexibel genoeg',      color: '#EF4444' },
  { id: 'r2', name: 'Geen match op soft skills', color: '#F59E0B' },
  { id: 'r3', name: 'Niet het juiste diploma',   color: '#6366F1' },
  { id: 'r4', name: 'Reisafstand',               color: '#0EA5E9' },
  { id: 'r5', name: 'Kandidaat geen interesse',  color: '#9CA3AF' },
  { id: 'r6', name: 'Kandidaat trekt zich terug', color: '#9CA3AF' },
  { id: 'r7', name: 'Overig',                    color: '#6B7280' },
]
