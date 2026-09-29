import type { Draft, Recipient, Snapshot } from './types.ts'
import { ACCOUNT, BANK, NAME, P, resolve } from './requirements.ts'
import {
  EMAIL,
  PHONE,
  ownPartyValues,
  normalizeContactValues,
} from './party-details.ts'

// Fictional postal addresses for the bundled demo recipients only.
const demoAddresses: Record<string, Record<string, string>> = {
  'demo-hk': {
    streetName: '18 Example Road',
    city: 'Hong Kong',
    country: 'HK',
  },
  'demo-cn': {
    streetName: '88 Example Road',
    city: 'Shanghai',
    postalCode: '200000',
    country: 'CN',
  },
  'demo-gh': { streetName: '8 Example Avenue', city: 'Accra', country: 'GH' },
  'demo-in': {
    streetName: '24 Example Road',
    city: 'Mumbai',
    postalCode: '400001',
    country: 'IN',
  },
  'demo-hk-external': {
    streetName: '42 Example Street',
    city: 'Hong Kong',
    country: 'HK',
  },
  'demo-tron': {
    streetName: '10 Example Road',
    city: 'Singapore',
    postalCode: '018956',
    country: 'SG',
  },
  'demo-wallet': {
    streetName: '3 Example Street',
    city: 'Zurich',
    postalCode: '8001',
    country: 'CH',
  },
}
export function demoAddressValues(id: string) {
  return Object.fromEntries(
    Object.entries(demoAddresses[id] ?? {}).map(([key, value]) => [
      P + 'party.address.' + key,
      value,
    ]),
  )
}
export function createDemoRecipients(snapshot: Snapshot): Recipient[] {
  const destinations = snapshot.index.countries
  const ruleRevision = (country: string) =>
    [
      snapshot.source.hashes[country],
      snapshot.source.hashes.model,
      snapshot.source.hashes.complementaryInfo,
    ].join(':')
  function seed(
    id: string,
    name: string,
    country: string,
    bank: string,
    account: string,
    routing: string,
    relationship: Draft['relationship'],
  ): Recipient {
    const currency = destinations.find((c) => c.countryCode === country)!
      .payoutCurrencies[0]
    const draft: Draft = {
      kind: 'bank',
      relationship,
      accountPurposes:
        relationship === 'own'
          ? ['deposit', 'withdraw']
          : id === 'demo-gh'
            ? ['deposit']
            : ['withdraw'],
      ...(relationship === 'external'
        ? { businessRelationship: id === 'demo-gh' ? 'CUSTOMER' : 'SUPPLIER' }
        : {}),
      bankAddress: demoAddresses[id]?.city + ', ' + country,
      country,
      currency,
      network: '',
      values: {
        ...demoAddressValues(id),
        [NAME]: name,
        [EMAIL]: `${id}@example.com`,
        [PHONE]: '+65-12345678',
        ...(country === 'CN'
          ? {
              [P + 'party.identification.identificationType']: 'CINC',
              [P + 'party.identification.identificationId']:
                '91310000123456789X',
            }
          : {}),
        [ACCOUNT]: account,
        [BANK + 'name']: bank,
        [country === 'CN' ? BANK + 'bic' : BANK + 'clearingSystemMemberId']:
          routing,
        [P + 'party.address.country']: country,
        ...(relationship === 'own' ? ownPartyValues : {}),
      },
    }
    return {
      ...draft,
      values: resolve(snapshot, draft).values,
      id,
      createdAt: '2026-09-29T00:00:00Z',
      updatedAt: '2026-09-29T00:00:00Z',
      demo: true,
      status: 'active',
      playbookHash: ruleRevision(country),
    }
  }
  return [
    seed(
      'demo-hk',
      'Axi Labs AG',
      'HK',
      'Example Bank Hong Kong',
      '001234567890',
      '004',
      'own',
    ),
    seed(
      'demo-cn',
      'Axi Labs AG',
      'CN',
      'Example Bank China',
      '6222021000012345678',
      'EXAMCNBJ',
      'own',
    ),
    seed(
      'demo-gh',
      'Coastal Trading Ltd',
      'GH',
      'Example Bank Ghana',
      '0234567890123',
      '130100',
      'external',
    ),
    seed(
      'demo-in',
      'Lotus Supply Co.',
      'IN',
      'Example Bank India',
      '001234567890',
      'HDFC0001234',
      'external',
    ),
    seed(
      'demo-hk-external',
      'Harbour Supply Ltd',
      'HK',
      'Example Bank Hong Kong',
      '008765432100',
      '004',
      'external',
    ),
    {
      id: 'demo-tron',
      kind: 'stablecoin',
      relationship: 'external',
      businessRelationship: 'SERVICE_PROVIDER',
      accountPurposes: ['withdraw'],
      country: '',
      currency: 'USDT',
      network: 'Tron',
      values: {
        ...demoAddressValues('demo-tron'),
        [NAME]: 'Harbour Digital Ltd',
        [ACCOUNT]: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
        [EMAIL]: 'wallet@example.com',
        [PHONE]: '+65-12345678',
      },
      createdAt: '2026-09-29T00:00:00Z',
      updatedAt: '2026-09-29T00:00:00Z',
      demo: true,
      status: 'active',
    },
    {
      id: 'demo-wallet',
      accountPurposes: ['deposit', 'withdraw'],
      kind: 'stablecoin',
      relationship: 'own',
      country: '',
      currency: 'USDT',
      network: 'Avalanche',
      values: {
        ...normalizeContactValues({ ...ownPartyValues }),
        [ACCOUNT]: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      },
      createdAt: '2026-09-29T00:00:00Z',
      updatedAt: '2026-09-29T00:00:00Z',
      demo: true,
      status: 'active',
    },
  ]
}
