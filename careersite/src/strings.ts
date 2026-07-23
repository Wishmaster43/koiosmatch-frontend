// Central NL copy for the public career site. One module, not strings scattered
// through JSX — an i18n-ready seam (a real multi-locale layer is a follow-up;
// this MVP only ships Dutch, the market this career site targets first).
export const strings = {
  header: {
    fallbackName: 'Vacatures',
  },
  home: {
    title: 'Geen tenant gekozen',
    body: 'Deze pagina toont vacatures per werkgever. Gebruik de link die je van je werkgever hebt gekregen, bijvoorbeeld /jouw-bedrijf/vacatures.',
  },
  inactive: {
    title: 'Deze vacaturesite is niet actief',
    body: 'Deze werkgever heeft de vacaturesite nog niet ingeschakeld. Kom later terug of neem contact op met de werkgever.',
  },
  notFound: {
    title: 'Pagina niet gevonden',
    body: 'Deze pagina bestaat niet (meer). Controleer de link of ga terug naar het vacature-overzicht.',
    backToList: 'Naar het vacature-overzicht',
  },
  list: {
    title: 'Openstaande vacatures',
    filtersLabel: 'Vacaturefilters',
    filters: {
      cityLabel: 'Stad',
      cityPlaceholder: 'Bijv. Utrecht',
      hoursLabel: 'Uren per week (min.)',
      hoursPlaceholder: 'Bijv. 24',
    },
    loading: 'Vacatures worden geladen…',
    error: 'De vacatures konden niet worden geladen.',
    retry: 'Opnieuw proberen',
    empty: 'Geen vacatures gevonden die aan je zoekopdracht voldoen.',
    hoursSuffix: 'uur p/w',
    salaryUnknown: 'Salaris in overleg',
    pagination: {
      previous: 'Vorige',
      next: 'Volgende',
      pageOf: (page: number, lastPage: number) => `Pagina ${page} van ${lastPage}`,
    },
  },
  detail: {
    back: 'Terug naar overzicht',
    loading: 'Vacature wordt geladen…',
    error: 'Deze vacature kon niet worden geladen.',
    notFound: 'Deze vacature bestaat niet (meer) of is niet meer actief.',
    remoteAllowed: 'Thuiswerken mogelijk',
    applyCta: 'Solliciteer direct',
  },
  apply: {
    heading: 'Solliciteren',
    firstName: 'Voornaam',
    lastName: 'Achternaam',
    email: 'E-mailadres',
    phone: 'Telefoonnummer',
    motivation: 'Motivatie (optioneel)',
    cv: 'CV (pdf of docx, max. 5MB, optioneel)',
    consentLabel:
      'Ik ga akkoord dat mijn gegevens worden gebruikt om mijn sollicitatie te behandelen. Zie de privacyverklaring van deze werkgever.',
    submit: 'Verstuur sollicitatie',
    submitting: 'Versturen…',
    success: (reference: string) => `Bedankt voor je sollicitatie! Referentie: ${reference}`,
    errorGeneric: 'Versturen is niet gelukt. Probeer het later opnieuw.',
    validation: {
      required: 'Dit veld is verplicht.',
      email: 'Vul een geldig e-mailadres in.',
      fileType: 'Alleen pdf of docx-bestanden zijn toegestaan.',
      fileSize: 'Het bestand mag maximaal 5MB zijn.',
      consent: 'Bevestig dat je akkoord gaat om te kunnen versturen.',
    },
  },
} as const
