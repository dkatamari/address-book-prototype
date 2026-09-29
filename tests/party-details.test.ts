import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import {
  changeOwnership,
  ownPartyDraft,
  ownPartyValues,
  partyValues,
  normalizeContactValues,
  contactErrors,
  partyFields,
  partyErrors,
  EMAIL,
  PHONE,
} from '../src/app/recipients/lib/party-details.ts'
import {
  ACCOUNT,
  BANK,
  NAME,
  resolve,
  walletErrors,
} from '../src/app/recipients/lib/requirements.ts'
import { stepErrors } from '../src/app/recipients/lib/form-flow.ts'
import {
  parseRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type { Draft, Snapshot } from '../src/app/recipients/lib/types.ts'

const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const external: Draft = {
  kind: 'bank',
  relationship: 'external',
  country: 'HK',
  currency: 'HKD',
  network: '',
  values: {
    [NAME]: 'External Company',
    [EMAIL]: 'external@example.com',
    [ACCOUNT]: '00123456789',
    [BANK + 'clearingSystemMemberId']: '004',
  },
}

test('ownership switches preserve bank details and restore the external party without leaking own details', () => {
  const own = changeOwnership(external, 'own', {})
  assert.equal(own.values[NAME], 'Axi Labs AG')
  assert.equal(own.values[ACCOUNT], '00123456789')
  assert.equal(own.values[PHONE], '+65 12345678')
  assert.deepEqual(
    changeOwnership(own, 'external', partyValues(external.values)),
    external,
  )
  const blank = changeOwnership(own, 'external', {})
  assert.deepEqual(partyValues(blank.values), {})
  assert.equal(external.values[NAME], 'External Company')
})

test('own party profile validates and contact details survive bank and wallet storage', () => {
  for (const kind of ['bank', 'stablecoin'] as const) {
    const draft = ownPartyDraft({ ...external, kind, relationship: 'own' })
    let values
    if (kind === 'bank') {
      const result = resolve(snapshot, draft)
      assert.deepEqual(result.errors, {})
      values = result.values
    } else {
      draft.currency = 'USDT'
      draft.network = 'Avalanche'
      draft.values[ACCOUNT] = '0x' + 'a'.repeat(40)
      assert.deepEqual(walletErrors(draft), {})
      values = normalizeContactValues(draft.values)
    }
    assert.equal(values[EMAIL], 'info@axiym.io')
    assert.equal(values[PHONE], '+65-12345678')
    const saved = {
      ...draft,
      values,
      id: 'account',
      createdAt: '',
      updatedAt: '',
    }
    assert.deepEqual(parseRecipients(serializeRecipients([saved])), [saved])
    assert.equal(ownPartyDraft(saved).values[PHONE], '+65 12345678')
  }
  assert.equal(ownPartyValues['payment.creditor.party.address.country'], 'CH')
})

test('party validation works before destination selection and reports malformed contact details', () => {
  const draft = {
    ...external,
    country: '',
    currency: '',
    values: {
      ...ownPartyValues,
      [NAME]: 'External Company',
      [EMAIL]: 'invalid',
      [PHONE]: 'not a phone',
    },
  }
  const result = resolve(snapshot, draft)
  assert.deepEqual(
    Object.keys(stepErrors(1, result.errors, result.fields)).sort(),
    [EMAIL, PHONE].sort(),
  )
  draft.values[EMAIL] = 'external@example.com'
  draft.values[PHONE] = '+65 12345678'
  const valid = resolve(snapshot, draft)
  assert.deepEqual(stepErrors(1, valid.errors, valid.fields), {})
  assert.ok(stepErrors(2, valid.errors, valid.fields).country)
  assert.deepEqual(contactErrors({}), {})
  assert.deepEqual(contactErrors({ [EMAIL]: ' ', [PHONE]: ' ' }), {})
})

test('bank and wallet party steps require every base field except building number, postal code and region', () => {
  const optional = [
    'payment.creditor.party.address.buildingNumber',
    'payment.creditor.party.address.postalCode',
    'payment.creditor.party.address.region',
  ]
  const complete = { ...ownPartyValues }
  for (const path of optional) delete complete[path]
  assert.deepEqual(partyErrors(complete), {})
  const bank = {
    ...external,
    values: { ...external.values, ...complete },
    country: '',
    currency: '',
  }
  const result = resolve(snapshot, bank)
  assert.deepEqual(stepErrors(1, result.errors, result.fields), {})
  for (const field of partyFields) {
    assert.equal(field.required, !optional.includes(field.path))
    if (!field.required) continue
    const missing = { ...complete, [field.path]: ' ' }
    assert.ok(partyErrors(missing)[field.path], field.path)
    const invalidBank = resolve(snapshot, { ...bank, values: missing })
    assert.ok(
      stepErrors(1, invalidBank.errors, invalidBank.fields)[field.path],
      field.path,
    )
  }
  const missingRegistration = resolve(snapshot, {
    ...bank,
    values: { ...complete, 'payment.creditor.party.countryOfResidence': '' },
  })
  assert.equal(
    missingRegistration.errors['payment.creditor.party.countryOfResidence'],
    undefined,
  )
  assert.equal(
    missingRegistration.fields.some(
      (field) => field.path === 'payment.creditor.party.countryOfResidence',
    ),
    false,
  )
})
