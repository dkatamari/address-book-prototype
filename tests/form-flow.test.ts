import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stepErrors } from '../src/app/recipients/lib/form-flow.ts'
import {
  parseRecipients,
  loadRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type { FormField, Recipient } from '../src/app/recipients/lib/types.ts'

const fields: FormField[] = [
  {
    path: 'payment.creditor.party.name',
    label: 'Name',
    section: 'party',
    required: true,
  },
  {
    path: 'payment.creditor.party.address.city',
    label: 'City',
    section: 'party',
    required: true,
  },
  { path: 'account.id', label: 'Account', section: 'account', required: true },
]
test('setup advances without destination or details, party step validates its own fields', () => {
  const errors = {
    country: 'Choose a country',
    'payment.creditor.party.name': 'Required',
    'payment.creditor.party.address': 'Incomplete',
    'account.id': 'Required',
    'rule:routing': 'Routing required',
  }
  assert.deepEqual(stepErrors(0, errors, fields), {})
  assert.deepEqual(stepErrors(1, errors, fields), {
    'payment.creditor.party.name': 'Required',
    'payment.creditor.party.address': 'Incomplete',
  })
  assert.deepEqual(stepErrors(2, errors, fields), errors)
  assert.deepEqual(
    stepErrors(
      1,
      { network: 'Choose a network', 'account.id': 'Required' },
      fields,
    ),
    {},
  )
})
test('retired account settings are removed without losing saved account details', () => {
  const recipient: Recipient = {
    id: 'test',
    kind: 'bank',
    relationship: 'own',
    country: 'HK',
    currency: 'HKD',
    network: '',
    values: { 'payment.creditor.party.name': 'Axi Labs AG' },
    createdAt: '',
    updatedAt: '',
  }
  for (const accountPurposes of [
    undefined,
    [],
    ['deposit'],
    ['withdraw'],
    ['deposit', 'withdraw'],
    ['invalid'],
  ]) {
    const old = { ...recipient, accountPurposes }
    assert.deepEqual(
      parseRecipients(JSON.stringify({ version: 1, recipients: [old] })),
      [recipient],
    )
    assert.deepEqual(JSON.parse(serializeRecipients([old])).recipients, [
      recipient,
    ])
    let stored = JSON.stringify({ version: 1, recipients: [old] })
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value
      },
    }
    assert.deepEqual(loadRecipients(storage, []), [recipient])
    assert.deepEqual(JSON.parse(stored).recipients, [recipient])
  }
})
