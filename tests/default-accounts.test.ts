import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { createDemoRecipients } from '../src/app/recipients/lib/demo-accounts.ts'
import {
  loadRecipients,
  parseRecipients,
  serializeRecipients,
  STORAGE_KEY,
} from '../src/app/recipients/lib/storage.ts'
import {
  resolve,
  walletErrors,
} from '../src/app/recipients/lib/requirements.ts'
import { businessRelationshipErrors } from '../src/app/recipients/lib/business-relationship.ts'
import type { Snapshot } from '../src/app/recipients/lib/types.ts'
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const defaults = createDemoRecipients(snapshot)
function memoryStorage(initial: string | null) {
  let raw = initial
  let writes = 0
  return {
    getItem(key: string) {
      assert.equal(key, STORAGE_KEY)
      return raw
    },
    setItem(key: string, value: string) {
      assert.equal(key, STORAGE_KEY)
      writes++
      raw = value
    },
    get writes() {
      return writes
    },
  }
}

test('seven defaults include two wallets, two own banks and three external banks with valid details', () => {
  assert.equal(defaults.length, 7)
  assert.equal(new Set(defaults.map((account) => account.id)).size, 7)
  const wallets = defaults.filter((account) => account.kind === 'stablecoin')
  assert.deepEqual(wallets.map((account) => account.network).sort(), [
    'Avalanche',
    'Tron',
  ])
  assert.equal(
    defaults.filter(
      (account) => account.kind === 'bank' && account.relationship === 'own',
    ).length,
    2,
  )
  assert.equal(
    defaults.filter(
      (account) =>
        account.kind === 'bank' && account.relationship === 'external',
    ).length,
    3,
  )
  for (const account of defaults) {
    assert.equal(account.demo, true)
    assert.equal(account.status, 'active')
    assert.deepEqual(businessRelationshipErrors(account), {}, account.id)
    assert.deepEqual(
      account.kind === 'bank'
        ? resolve(snapshot, account).errors
        : walletErrors(account),
      {},
      account.id,
    )
  }
})
test('missing and empty storage get persistent defaults only once', () => {
  for (const initial of [null, serializeRecipients([])]) {
    const storage = memoryStorage(initial)
    assert.deepEqual(loadRecipients(storage, defaults), defaults)
    assert.equal(storage.writes, 1)
    assert.deepEqual(parseRecipients(storage.getItem(STORAGE_KEY)!), defaults)
    assert.deepEqual(loadRecipients(storage, defaults), defaults)
    assert.equal(storage.writes, 1)
  }
})
test('a nonempty address book is kept exactly as saved without topping it up', () => {
  const existing = [
    {
      ...defaults[0],
      id: 'user-account',
      demo: undefined,
      status: 'pending_review' as const,
    },
  ]
  const raw = serializeRecipients(existing)
  const storage = memoryStorage(raw)
  assert.deepEqual(loadRecipients(storage, defaults), parseRecipients(raw))
  assert.equal(storage.getItem(STORAGE_KEY), raw)
  assert.equal(storage.writes, 0)
})
test('invalid and inaccessible storage is not replaced, and failed persistence is reported', () => {
  const corrupt = memoryStorage('{invalid')
  assert.throws(() => loadRecipients(corrupt, defaults))
  assert.equal(corrupt.getItem(STORAGE_KEY), '{invalid')
  assert.equal(corrupt.writes, 0)
  let writes = 0
  assert.throws(
    () =>
      loadRecipients(
        {
          getItem() {
            throw new Error('Denied')
          },
          setItem() {
            writes++
          },
        },
        defaults,
      ),
    /Denied/,
  )
  assert.equal(writes, 0)
  assert.throws(
    () =>
      loadRecipients(
        {
          getItem() {
            return null
          },
          setItem() {
            throw new Error('Full')
          },
        },
        defaults,
      ),
    /Full/,
  )
})

test('own defaults use Axi Labs AG in Switzerland while bank countries remain Hong Kong and China', () => {
  const own = defaults.filter((account) => account.relationship === 'own')
  assert.equal(own.length, 3)
  for (const account of own) {
    assert.equal(account.values['payment.creditor.party.name'], 'Axi Labs AG')
    assert.equal(account.values['payment.creditor.party.address.country'], 'CH')
    assert.equal(
      account.values['payment.creditor.party.address.streetName'],
      'Baarerstrasse',
    )
    assert.equal(
      account.values['payment.creditor.party.address.buildingNumber'],
      '12',
    )
    assert.equal(
      account.values['payment.creditor.party.address.postalCode'],
      '6300',
    )
    assert.equal(account.values['payment.creditor.party.address.city'], 'Zug')
  }
  assert.deepEqual(
    own
      .filter((account) => account.kind === 'bank')
      .map((account) => account.country),
    ['HK', 'CN'],
  )
})

test('previously stored own examples refresh the party profile without changing bank details or user entries', () => {
  const legacy = defaults
    .filter((account) => account.relationship === 'own')
    .map((account) => ({
      ...account,
      values: {
        ...account.values,
        'payment.creditor.party.name': 'Old Example Name',
        'payment.creditor.party.address.country': account.country || 'SG',
        'payment.creditor.party.address.streetName': 'Old Example Street',
      },
    }))
  const user = { ...legacy[0], id: 'user-own-account', demo: undefined }
  const external = defaults.find(
    (account) => account.relationship === 'external',
  )!
  const storage = memoryStorage(
    serializeRecipients([...legacy, user, external]),
  )
  const migrated = loadRecipients(storage, defaults)
  assert.equal(storage.writes, 1)
  for (let i = 0; i < legacy.length; i++) {
    assert.equal(
      migrated[i].values['payment.creditor.party.name'],
      'Axi Labs AG',
    )
    assert.equal(
      migrated[i].values['payment.creditor.party.address.country'],
      'CH',
    )
    assert.equal(migrated[i].country, legacy[i].country)
    for (const [path, value] of Object.entries(legacy[i].values)) {
      if (!path.startsWith('payment.creditor.party.'))
        assert.equal(migrated[i].values[path], value)
    }
  }
  assert.deepEqual(
    migrated[legacy.length],
    parseRecipients(serializeRecipients([user]))[0],
  )
  assert.deepEqual(migrated[legacy.length + 1], external)
  assert.deepEqual(loadRecipients(storage, defaults), migrated)
  assert.equal(storage.writes, 1)
})
