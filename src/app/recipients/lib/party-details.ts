import type { Draft, FormField, Values } from './types.ts'

const PARTY = 'payment.creditor.party.'
export const EMAIL = PARTY + 'contact.emailAddress'
export const PHONE = PARTY + 'contact.phoneNumber'
export const partyFields: FormField[] = [
  {
    path: PARTY + 'name',
    label: 'Account Holder Name',
    required: true,
    section: 'party',
  },
  ...[
    ['streetName', 'Street'],
    ['buildingNumber', 'Building Number'],
    ['postalCode', 'Postal Code'],
    ['country', 'Country'],
    ['city', 'City'],
    ['region', 'Region'],
  ].map(([key, label]) => ({
    path: PARTY + 'address.' + key,
    label,
    required: !['buildingNumber', 'postalCode', 'region'].includes(key),
    section: 'party' as const,
  })),
  { path: EMAIL, label: 'Email', required: true, section: 'party' },
  {
    path: PHONE,
    label: 'Phone number',
    required: true,
    section: 'party',
    hint: 'Include the country code, for example +65 12345678.',
  },
]

export const ownPartyValues: Readonly<Values> = {
  [PARTY + 'name']: 'Axi Labs AG',
  [PARTY + 'address.streetName']: 'Baarerstrasse',
  [PARTY + 'address.buildingNumber']: '12',
  [PARTY + 'address.postalCode']: '6300',
  [PARTY + 'address.country']: 'CH',
  [PARTY + 'address.city']: 'Zug',
  [PARTY + 'address.region']: '',
  [EMAIL]: 'info@axiym.io',
  [PHONE]: '+65 12345678',
}
export function ownPartyDraft(draft: Draft): Draft {
  return draft.relationship === 'own'
    ? { ...draft, values: { ...draft.values, ...ownPartyValues } }
    : draft
}
export function partyValues(values: Values): Values {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) => path.startsWith(PARTY)),
  )
}
export function changeOwnership(
  draft: Draft,
  relationship: Draft['relationship'],
  externalParty: Values,
): Draft {
  const accountValues = Object.fromEntries(
    Object.entries(draft.values).filter(([path]) => !path.startsWith(PARTY)),
  )
  return ownPartyDraft({
    ...draft,
    relationship,
    values: {
      ...accountValues,
      ...(relationship === 'external' ? externalParty : {}),
    },
  })
}
// Preserve the supplied country-code boundary rather than guessing it from a
// compact number. The canonical model uses a hyphen after the calling code.
export function normalizeContactValues(values: Values): Values {
  const phone = values[PHONE]?.trim() ?? ''
  const split = phone.match(/^\+(\d{1,3})[\s-]+(.+)$/)
  return {
    ...values,
    ...(values[EMAIL] !== undefined ? { [EMAIL]: values[EMAIL].trim() } : {}),
    ...(values[PHONE] !== undefined
      ? {
          [PHONE]: split
            ? `+${split[1]}-${split[2].replace(/\s/g, '')}`
            : phone,
        }
      : {}),
  }
}
export function contactErrors(values: Values): Values {
  const normalized = normalizeContactValues(values)
  const errors: Values = {}
  if (
    normalized[EMAIL] &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized[EMAIL])
  )
    errors[EMAIL] = 'Enter a valid email address.'
  if (
    normalized[PHONE] &&
    !/^\+[0-9]{1,3}-[0-9()+\-]{1,30}$/.test(normalized[PHONE])
  )
    errors[PHONE] =
      'Enter the country code and phone number, for example +65 12345678.'
  return errors
}
export function partyErrors(values: Values): Values {
  const errors = contactErrors(values)
  for (const field of partyFields) {
    if (field.required && !values[field.path]?.trim())
      errors[field.path] = `${field.label} is required.`
  }
  return errors
}
