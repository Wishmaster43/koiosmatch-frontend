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
      title: 'Filters',
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
    // Accessible name for the dependency-free EU country-code <select> next to the
    // phone input (formulier-v2) — distinct from `phone` so screen readers announce
    // the two controls separately even though they visually form one field.
    phoneCountryCodeLabel: 'Landcode telefoonnummer',
    // Base label only — required/optional now shows via the shared `*` marker
    // (settings-driven, formulier-v2), never a hardcoded "(optioneel)" suffix.
    motivation: 'Motivatie',
    // Rich-text toolbar tooltips/aria-labels (Danny 23-07 — RichTextArea, dependency-free).
    richText: {
      bold: 'Vet',
      italic: 'Cursief',
      bulletList: 'Opsommingslijst',
      numberedList: 'Genummerde lijst',
    },
    cv: 'CV (pdf of docx, max. 5MB)',
    // Address block (formulier-v2, CAREERSITE-APPLY-2) — always optional, the
    // backend only fills blank candidate fields so there is no required variant.
    address: {
      sectionTitle: 'Adres (optioneel)',
      street: 'Straat',
      houseNumber: 'Huisnummer',
      postcode: 'Postcode',
      city: 'Plaats',
    },
    // Profile photo — hidden by default (AVG); only rendered when the vacancy opts in.
    photo: {
      label: 'Pasfoto',
      removeLabel: 'Foto verwijderen',
      previewAlt: 'Voorvertoning van de geüploade foto',
      avgNote:
        'Deze foto wordt alleen gebruikt voor je sollicitatie en behandeld volgens de privacyverklaring van deze werkgever.',
    },
    // Repeatable work-experience entries (jaicob-style reference form, formulier-v2).
    experience: {
      sectionTitle: 'Werkervaring',
      addButton: '+ Werkervaring toevoegen',
      company: 'Bedrijfsnaam',
      title: 'Functietitel',
      location: 'Locatie',
      startDate: 'Startdatum',
      endDate: 'Einddatum',
      responsibilities: 'Verantwoordelijkheden',
      achievements: 'Prestaties',
      saveButton: 'Toevoegen',
      saveEditButton: 'Opslaan',
      cancelButton: 'Annuleren',
      editLabel: 'Werkervaring bewerken',
      removeLabel: 'Werkervaring verwijderen',
      companyRequired: 'Vul een bedrijfsnaam in.',
    },
    // Repeatable education entries.
    education: {
      sectionTitle: 'Opleiding',
      addButton: '+ Opleiding toevoegen',
      name: 'Naam / diploma',
      organisation: 'Organisatie / school',
      issuedDate: 'Datum uitgifte',
      licenseNumber: 'Licentienummer',
      saveButton: 'Toevoegen',
      saveEditButton: 'Opslaan',
      cancelButton: 'Annuleren',
      editLabel: 'Opleiding bewerken',
      removeLabel: 'Opleiding verwijderen',
      nameRequired: 'Vul een naam of diploma in.',
    },
    remarks: {
      label: 'Vragen of opmerkingen',
    },
    interviewConsent: {
      label: 'Ik ga akkoord dat Koios AI mij mag interviewen als onderdeel van deze sollicitatie.',
    },
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
      motivationLength: 'Motivatie mag maximaal 5000 tekens bevatten.',
      photoFileType: 'Alleen jpg, jpeg, png of webp-bestanden zijn toegestaan.',
      photoFileSize: 'Het bestand mag maximaal 4MB zijn.',
      remarksLength: 'Mag maximaal 2000 tekens bevatten.',
      interviewConsentRequired: 'Bevestig dat je akkoord gaat om te kunnen versturen.',
    },
  },
} as const
