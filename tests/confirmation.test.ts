import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { confirmationDetails } from '../src/app/recipients/lib/confirmation.ts'
import {
  ACCOUNT,
  BANK,
  resolve,
} from '../src/app/recipients/lib/requirements.ts'
import {
  ownPartyValues,
  partyFields,
} from '../src/app/recipients/lib/party-details.ts'
import type {
  Draft,
  Snapshot,
  FormField,
} from '../src/app/recipients/lib/types.ts'
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const countryName = (code: string) => (code === 'CH' ? 'Switzerland' : code)
const draft: Draft = {
  kind: 'bank',
  relationship: 'external',
  businessRelationship: 'SUPPLIER',
  country: 'CN',
  currency: 'CNY',
  network: '',
  bankAddress: '88 Bank Street, Shanghai',
  values: {
    ...ownPartyValues,
    [ACCOUNT]: '00123456789',
    [BANK + 'name']: 'Example Bank',
    [BANK + 'bic']: 'EXAMCNBJ',
    'payment.creditor.party.identification.identificationType': 'CINC',
    'payment.creditor.party.identification.identificationId': 'REG-1234',
  },
}
test('bank confirmation includes the full party address, contacts and country-required identity', () => {
  const result = confirmationDetails(
    draft,
    resolve(snapshot, draft).fields,
    countryName,
  )
  const party = Object.fromEntries(
    result.party.map(({ label, value }) => [label, value]),
  )
  const account = Object.fromEntries(
    result.account.map(({ label, value }) => [label, value]),
  )
  assert.equal(party.Address, 'Baarerstrasse 12\n6300 Zug\nSwitzerland')
  assert.equal(party.Email, 'info@axiym.io')
  assert.equal(party['Phone number'], '+65 12345678')
  assert.equal(party.Relationship, 'Supplier')
  assert.equal(account['Account Number/IBAN'], '00123456789')
  assert.equal(account['SWIFT/BIC'], 'EXAMCNBJ')
  assert.equal(account['Bank Name'], 'Example Bank')
  assert.equal(account['Bank Address'], '88 Bank Street, Shanghai')
  assert.equal(
    account['Account owner identification type'],
    'Registration number',
  )
  assert.equal(account['Account owner identification number'], 'REG-1234')
})
test('bank address remains visible without a bank name and own accounts omit external relationship', () => {
  const own = {
    ...draft,
    relationship: 'own' as const,
    values: { ...draft.values, [BANK + 'name']: '' },
  }
  const result = confirmationDetails(
    own,
    resolve(snapshot, own).fields,
    countryName,
  )
  assert.equal(
    result.party.some((item) => item.label === 'Relationship'),
    false,
  )
  assert.equal(
    result.account.find((item) => item.label === 'Bank Address')?.value,
    draft.bankAddress,
  )
})
test('wallet confirmation retains the entire wallet address and separate party contact details', () => {
  const wallet: Draft = {
    ...draft,
    kind: 'stablecoin',
    network: 'Avalanche',
    currency: 'USDT',
    bankAddress: undefined,
    values: { ...ownPartyValues, [ACCOUNT]: '0x' + 'a'.repeat(40) },
  }
  const fields: FormField[] = [
    ...partyFields,
    {
      path: ACCOUNT,
      label: 'Wallet address',
      section: 'account',
      required: true,
    },
  ]
  const result = confirmationDetails(wallet, fields, countryName)
  assert.deepEqual(result.account, [
    { label: 'Wallet address', value: wallet.values[ACCOUNT] },
  ])
  assert.ok(result.party.some((item) => item.label === 'Email'))
  assert.equal(
    result.party.some((item) => item.value === 'CH'),
    false,
  )
})
