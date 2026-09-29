import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  stepErrors,
  purposeSummary,
  purposeErrors,
} from '../src/app/recipients/lib/form-flow.ts'
import {
  parseRecipients,
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
test('account purposes survive storage and older records need no migration', () => {
  const recipient: Recipient = {
    id: 'test',
    kind: 'bank',
    relationship: 'own',
    country: 'HK',
    currency: 'HKD',
    network: '',
    values: {},
    createdAt: '',
    updatedAt: '',
  }
  assert.deepEqual(parseRecipients(serializeRecipients([recipient])), [
    recipient,
  ])
  const updated: Recipient = {
    ...recipient,
    accountPurposes: ['deposit', 'withdraw'],
  }
  assert.deepEqual(parseRecipients(serializeRecipients([updated])), [updated])
  assert.equal(
    purposeSummary(updated.accountPurposes),
    'Deposit funds from · Withdraw/send funds to',
  )
  assert.equal(purposeSummary([]), 'Not specified')
  assert.throws(() =>
    parseRecipients(
      JSON.stringify({
        version: 1,
        recipients: [{ ...recipient, accountPurposes: ['invalid'] }],
      }),
    ),
  )
})

test('Account Type requires either purpose or both, without validating later steps', () => {
  for (const purposes of [undefined, []]) {
    const errors = purposeErrors(purposes)
    assert.equal(errors.accountPurposes, 'Select at least one option to enable.')
    assert.deepEqual(
      stepErrors(
        0,
        { ...errors, country: 'Missing', businessRelationship: 'Missing' },
        fields,
      ),
      errors,
    )
    assert.ok(stepErrors(2, errors, fields).accountPurposes)
  }
  for (const purposes of [
    ['deposit'],
    ['withdraw'],
    ['deposit', 'withdraw'],
  ] as const) {
    assert.deepEqual(purposeErrors([...purposes]), {})
  }
})
