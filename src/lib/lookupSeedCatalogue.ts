/**
 * lookupSeedCatalogue — LOOKUP-I18N-1 (Danny 25-08, option c): the product's SEEDED
 * lookup values, per family, with the exact Dutch label the seed ships. A value that
 * still carries this label is a product default and may be shown in the user's own
 * language; anything else is the tenant's own text and is rendered as typed.
 *
 * MEASURED, not copied: generated from the live API through e2e/probe-lookups.mjs on
 * 2026-08-25 (the frontend's own DEFAULT_* constants had drifted from the seed, e.g.
 * "Uitgenodigd/Intake" as one value where the server ships two, and "TeDoen" for
 * "Te doen"). Re-run that probe and regenerate when the backend seed changes.
 *
 * Two keying schemes, because the backend uses two:
 *   - slug families: the lookup row carries a stable value ('available', 'applied'),
 *     which is the translation key.
 *   - LABEL_KEYED families: the row carries only a per-tenant uuid, so the seeded
 *     Dutch label is the only stable handle and its camelCase form is the key.
 */

import { WORKFLOW_SEED_LABELS } from './lookupSeedCatalogueWorkflows'

// Families whose rows have no stable value; their key is derived from the seed label.
export const LABEL_KEYED: ReadonlySet<string> = new Set([
  'candidateSources', 'channels', 'contactFunctions', 'documentTypes', 'driverLicenses', 'educationLevels', 'escalationReasons', 'functions', 'industries', 'languageLevels', 'languages', 'nationalities', 'pools', 'rejectionReasons', 'seniorityLevels', 'skillLevels', 'vacancyStatuses',
  // WORKFLOW-I18N-1 (25-08): workflowFolders/workflowNames DO carry a stable slug
  // (folder.key / workflow.template_key), but the match is deliberately on the LABEL —
  // "does this still read as what we seeded" is exactly the LABEL_KEYED semantic, and it
  // needs no extra API field threaded through the FE mapper to work.
  'workflowFolders', 'workflowNames',
])

// family -> translation key -> the Dutch label the seed ships with.
export const SEED_LABELS: Record<string, Record<string, string>> = {
  appointmentLocations: {
    kantoor: "Kantoor",
    online: "Online",
    telefonisch: "Telefonisch",
    bij_klant: "Bij klant",
  },
  appointmentTypes: {
    intake: "Intake",
    kennismaking: "Kennismaking",
    belafspraak: "Belafspraak",
    online: "Online gesprek",
  },
  candidateSources: {
    careersite: "Careersite",
    doorverwijzing: "Doorverwijzing",
    facebook: "Facebook",
    indeed: "Indeed",
    inloop: "Inloop",
    linkedin: "LinkedIn",
    website: "Website",
    werkzoekenNl: "Werkzoeken.nl",
    referral: "referral",
    werkzoeken: "werkzoeken",
    walkIn: "walk_in",
  },
  candidateTypes: {
    on_call: "Oproepkracht",
    freelance: "ZZP",
    payroll: "Payroll",
    temp_agency: "Uitzend",
    flex_services: "Flex-diensten",
    secondment: "Detachering",
    on_demand: "Demand",
  },
  cao: {
    abu: "CAO ABU",
    nbbu: "CAO NBBU",
  },
  // Job-board channels (VacancyLookupSeeder::seedChannels). The FE always pins
  // `value` to the row's uuid (CHANNEL-KEY-1), so this is LABEL_KEYED like the
  // other uuid-only lookups, not a slug family.
  channels: {
    carrierePagina: "Carrière-pagina",
    googleJobs: "Google Jobs",
    indeed: "Indeed",
    werkzoeken: "Werkzoeken",
  },
  contactFunctions: {
    hrManager: "HR-manager",
    recruiter: "Recruiter",
    planner: "Planner",
    teamleider: "Teamleider",
    operationeelManager: "Operationeel manager",
    locatiemanager: "Locatiemanager",
    directeur: "Directeur",
    administratie: "Administratie",
  },
  contractTypes: {
    uitzendbeding: "Uitzendbeding (fase A)",
    detachering: "Detachering",
    bepaalde_tijd: "Bepaalde tijd",
    onbepaalde_tijd: "Onbepaalde tijd",
    zzp: "ZZP",
    payroll: "Payroll",
  },
  customerPhases: {
    prospect: "Prospect",
    klant: "Klant",
  },
  customerStatuses: {
    active: "Actief",
    inactive: "Inactief",
    blocked: "Geblokkeerd",
  },
  // Document types (GET /document-types?entity=candidate), rows are uuid-keyed like the
  // other LABEL_KEYED families — measured live 2026-08-25.
  documentTypes: {
    cv: "CV",
    idBewijs: "ID-bewijs",
    foto: "Foto",
    diploma: "Diploma",
    contract: "Contract",
    vog: "VOG",
    certificaat: "Certificaat",
    bankpasPrive: "Bankpas privé",
    bankpasZakelijk: "Bankpas zakelijk",
    overig: "Overig",
  },
  driverLicenses: {
    am: "AM",
    a1: "A1",
    a2: "A2",
    a: "A",
    b: "B",
    be: "BE",
    c1: "C1",
    c1e: "C1E",
    c: "C",
    ce: "CE",
    d1: "D1",
    d1e: "D1E",
    d: "D",
    de: "DE",
    t: "T",
  },
  educationLevels: {
    basisonderwijs: "Basisonderwijs",
    vmbo: "VMBO",
    havo: "HAVO",
    vwo: "VWO",
    mbo1: "MBO-1",
    mbo2: "MBO-2",
    mbo3: "MBO-3",
    mbo4: "MBO-4",
    hbo: "HBO",
    hboMaster: "HBO-master",
    wo: "WO",
    woMaster: "WO-master",
    mbo: "MBO",
  },
  emergencyRelations: {
    partner: "Partner",
    ouder: "Ouder",
    kind: "Kind",
    broer_zus: "Broer/zus",
    vriend: "Vriend(in)",
    familie: "Familie",
    anders: "Anders",
  },
  escalationReasons: {
    boos: "Boos",
    ongeluk: "Ongeluk",
    overig: "Overig",
    overlijden: "Overlijden",
    uitschrijven: "Uitschrijven",
    ziek: "Ziek",
  },
  functions: {
    kok: "Kok",
    zelfstandigWerkendKok: "Zelfstandig werkend kok",
    bedieningsmedewerker: "Bedieningsmedewerker",
    barmanBarvrouw: "Barman/Barvrouw",
    gastheerGastvrouw: "Gastheer/Gastvrouw",
    cateringmedewerker: "Cateringmedewerker",
    // zorg preset (SeedsCandidates.php ~line 99-105)
    verzorgendeIG: "Verzorgende IG",
    helpendePlus: "Helpende Plus",
    verpleegkundigeN4: "Verpleegkundige N4",
    verpleegkundigeN5: "Verpleegkundige N5",
    helpende: "Helpende",
    doktersassistent: "Doktersassistent",
    wijkverpleegkundige: "Wijkverpleegkundige",
    // logistiek preset
    orderpicker: "Orderpicker",
    heftruckchauffeur: "Heftruckchauffeur",
    magazijnmedewerker: "Magazijnmedewerker",
    logistiekMedewerker: "Logistiek medewerker",
    chauffeurCE: "Chauffeur CE",
    inpakker: "Inpakker",
    // beveiliging preset
    beveiliger: "Beveiliger",
    objectbeveiliger: "Objectbeveiliger",
    evenementbeveiliger: "Evenementbeveiliger",
    surveillant: "Surveillant",
    receptiebeveiliger: "Receptiebeveiliger",
    mobielSurveillant: "Mobiel surveillant",
    // scale-vacancy-only titles (SeedsScaleVacancies.php SCALE_VACANCY_TITLES)
    begeleiderGHZ: "Begeleider GHZ",
    evvEr: "EVV'er",
    teamleiderWarehouse: "Teamleider warehouse",
  },
  funnelTypes: {
    applied: "Gesolliciteerd",
    invited: "Uitgenodigd",
    intake: "Intake",
    proposal: "Voorgesteld",
    hired: "Aangenomen",
    rejected: "Afgewezen",
  },
  genders: {
    male: "Man",
    female: "Vrouw",
    other: "Anders",
  },
  industries: {
    werving: "Werving",
    techniek: "Techniek",
    uitzendbureau: "Uitzendbureau",
    horeca: "Horeca",
    logistiek: "Logistiek",
    zorg: "Zorg",
    it: "IT",
    retail: "Retail",
    bouw: "Bouw",
    productie: "Productie",
    administratie: "Administratie",
    onderwijs: "Onderwijs",
    financien: "Financiën",
    overig: "Overig",
  },
  languageLevels: {
    slecht: "Slecht",
    matig: "Matig",
    goed: "Goed",
    zeerGoed: "Zeer goed",
    moedertaal: "Moedertaal",
  },
  languages: {
    nederlands: "Nederlands",
    engels: "Engels",
    duits: "Duits",
    frans: "Frans",
    spaans: "Spaans",
    pools: "Pools",
    turks: "Turks",
    arabisch: "Arabisch",
    papiaments: "Papiaments",
    portugees: "Portugees",
    italiaans: "Italiaans",
    roemeens: "Roemeens",
    oekraiens: "Oekraïens",
  },
  lastContactTypes: {
    email: "Email",
    whatsapp: "WhatsApp",
    appointment: "Afspraak",
    call: "Belafspraak",
    meet: "Online meeting",
  },
  matchStatuses: {
    open: "Open",
    closed: "Afgesloten",
  },
  nationalities: {
    antilliaans: "Antilliaans",
    belgisch: "Belgisch",
    brits: "Brits",
    bulgaars: "Bulgaars",
    duits: "Duits",
    eritrees: "Eritrees",
    frans: "Frans",
    grieks: "Grieks",
    hongaars: "Hongaars",
    italiaans: "Italiaans",
    marokkaans: "Marokkaans",
    nederlands: "Nederlands",
    oekraiens: "Oekraïens",
    overig: "Overig",
    pools: "Pools",
    portugees: "Portugees",
    roemeens: "Roemeens",
    somalisch: "Somalisch",
    spaans: "Spaans",
    surinaams: "Surinaams",
    syrisch: "Syrisch",
    turks: "Turks",
  },
  noteTypes: {
    general: "Algemeen",
    intake: "Intake",
    feedback: "Feedback",
    appointment: "Afspraak",
    followup: "Follow-up",
    warning: "Waarschuwing",
    status_change: "Statuswissel",
    lifecycle: "Levenscyclus",
  },
  numberingEntities: {
    candidate: "Kandidaat",
    customer: "Klant",
    vacancy: "Vacature",
    customer_location: "Vestiging klant",
    customer_department: "Afdeling klant",
    match: "Match",
    application: "Sollicitatie",
    task: "Taak",
    opportunity: "Kans",
    outreach_campaign: "Belronde",
    customer_contact: "Contactpersoon",
    location: "Vestiging (eigen)",
    zzp_creditor: "Zzp creditor",
  },
  opportunityStages: {
    lead: "Lead",
    qualified: "Gekwalificeerd",
    proposal: "Voorstel",
    negotiation: "Onderhandeling",
    won: "Gewonnen",
    lost: "Verloren",
  },
  outcomes: {
    no_answer: "Geen gehoor",
    callback: "Terugbellen",
    not_interested: "Geen interesse",
    interested: "Interesse",
  },
  outreachStatuses: {
    todo: "Te doen",
    contacted: "Benaderd",
    answered: "Beantwoord",
    skipped: "Overgeslagen",
  },
  phases: {
    lead: "Lead",
    candidate: "Kandidaat",
  },
  pools: {
    actieveKandidaten: "Actieve kandidaten",
    warmeLeads: "Warme leads",
    interessantLater: "Interessant later",
    topKandidaten: "Top kandidaten",
  },
  referenceRelations: {
    manager: "Manager",
    collega: "Collega",
    klant: "Klant",
    opdrachtgever: "Opdrachtgever",
    docent: "Docent",
    anders: "Anders",
  },
  rejectionReasons: {
    andereKandidaatGekozen: "Andere kandidaat gekozen",
    geenCultureleMatch: "Geen culturele match",
    nietGekwalificeerd: "Niet gekwalificeerd",
    onvoldoendeErvaring: "Onvoldoende ervaring",
    salariswensTeHoog: "Salariswens te hoog",
    teGroteReisafstand: "Te grote reisafstand",
    teruggetrokkenDoorKandidaat: "Teruggetrokken door kandidaat",
  },
  // Vacancy seniority levels (VacancySeniorityLevel has no value/key column, only
  // uuid `id`), so this is LABEL_KEYED like the other uuid-only lookups.
  seniorityLevels: {
    starter: "Starter",
    medior: "Medior",
    professional: "Professional",
    senior: "Senior",
  },
  skillLevels: {
    basis: "Basis",
    gevorderd: "Gevorderd",
    expert: "Expert",
  },
  statuses: {
    available: "Beschikbaar",
    placed: "Geplaatst",
    unavailable: "Niet beschikbaar",
    sick: "Ziek",
    leave: "Verlof",
    blacklist: "Blacklist",
  },
  subStatuses: {
    active: "Actief",
    inactive: "Inactief",
  },
  taskPriorities: {
    low: "Laag",
    normal: "Normaal",
    high: "Hoog",
  },
  taskStatuses: {
    todo: "Te doen",
    in_progress: "In behandeling",
    done: "Afgerond",
  },
  taskTypes: {
    task: "Taak",
    call: "Belafspraak",
    email: "E-mail",
    note: "Notitie",
  },
  vacancyStatuses: {
    open: "Open",
    concept: "Concept",
    gepauzeerd: "Gepauzeerd",
    gesloten: "Gesloten",
  },
  // Workflow folder/template names live in their own file — see
  // lookupSeedCatalogueWorkflows.ts for why this catalogue split there.
  ...WORKFLOW_SEED_LABELS,
  workPermitTypes: {
    geen_vergunning_nodig: "Geen vergunning nodig (NL/EU)",
    twv: "Tewerkstellingsvergunning (TWV)",
    gvva: "Gecombineerde vergunning (GVVA)",
    kennismigrant: "Kennismigrant",
    onbekend: "Onbekend",
  },
}
