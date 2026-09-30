import raw from '@/data/playbooks/snapshot.json'
import type { Draft, Recipient, Snapshot } from './types'
import { P } from './requirements'
import { createDemoRecipients, demoAddressValues } from './demo-accounts'
export const snapshot = raw as unknown as Snapshot
export const destinations = snapshot.index.countries
export function ruleRevision(country: string) {
  return [
    snapshot.source.hashes[country],
    snapshot.source.hashes.model,
    snapshot.source.hashes.complementaryInfo,
  ].join(':')
}
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
export const countryName = (code: string) =>
  destinations.find((c) => c.countryCode === code)?.countryName ??
  (/^[A-Z]{2}$/.test(code) ? (regionNames.of(code) ?? code) : code)
export function emptyDraft(kind: Draft['kind'] = 'bank'): Draft {
  return {
    kind,
    relationship: 'own',
    country: '',
    currency: kind === 'bank' ? '' : 'USDT',
    network: 'Avalanche',
    values: {},
  }
}
export const demoRecipients = createDemoRecipients(snapshot)
export function recipientAddress(r: Recipient) {
  const prefix = P + 'party.address.'
  const hasPostalAddress = [
    'streetName',
    'buildingNumber',
    'city',
    'region',
    'postalCode',
  ].some((key) => r.values[prefix + key])
  // Older stored demo fixtures also get their sample address, without changing
  // storage or substituting an address on a user-created recipient.
  const values =
    r.demo && !hasPostalAddress
      ? { ...r.values, ...demoAddressValues(r.id) }
      : r.values
  const field = (key: string) => values[prefix + key]
  return (
    [
      [field('buildingNumber'), field('streetName')].filter(Boolean).join(' '),
      field('city'),
      field('region'),
      field('postalCode'),
      countryName(field('country') || r.country),
    ]
      .filter(Boolean)
      .join(', ') || 'No address provided'
  )
}
