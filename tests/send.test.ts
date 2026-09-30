import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { createDemoRecipients } from '../src/app/recipients/lib/demo-accounts.ts'
import type { Snapshot } from '../src/app/recipients/lib/types.ts'
import {
  canSendTo,
  parseAmount,
  estimate,
  sourceForTarget,
  createQuote,
  confirmTransfer,
  INITIAL_BALANCES,
  transactionPurposes,
} from '../src/app/send/lib/transfer.ts'
const snapshot: Snapshot = JSON.parse(
  fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
)
const accounts = createDemoRecipients(snapshot)
const ghana = accounts.find((r) => r.id === 'demo-gh')!
const now = Date.parse('2026-09-29T00:00:00Z')
const quote = () => createQuote(ghana, 'USDT', 1000000, now, 'quote-1')

test('send selection admits only active bank accounts', () => {
  assert.equal(canSendTo(ghana), true)
  for (const account of [
    { ...ghana, status: 'pending_review' as const },
    { ...ghana, kind: 'stablecoin' as const, network: 'Ethereum' },
  ])
    assert.equal(canSendTo(account), false)
  assert.equal(accounts.filter(canSendTo).length, 5)
})
test('wallets cannot be quoted or submitted, including a previously prepared wallet quote', () => {
  for (const wallet of accounts.filter(
    (account) => account.kind === 'stablecoin',
  )) {
    assert.equal(canSendTo(wallet), false)
    assert.throws(
      () => createQuote(wallet, 'USDT', 1000000, now, 'wallet'),
      /bank account/,
    )
    const oldQuote = {
      ...quote(),
      recipientId: wallet.id,
      recipientVersion: JSON.stringify(wallet),
      currency: wallet.currency,
    }
    assert.throws(
      () => confirmTransfer([wallet], oldQuote, '', 'SUPPLIER_PAYMENT', now),
      /no longer available/,
    )
  }
})
test('source and recipient amounts calculate with fee-inclusive minor units', () => {
  assert.equal(parseAmount('10000'), 1000000)
  assert.equal(parseAmount('0.29'), 29)
  for (const value of ['-1', '1e3', '10,000', '1.001', '', 'NaN', 'Infinity'])
    assert.equal(parseAmount(value), undefined)
  assert.equal(parseAmount('100.5', 0), undefined)
  assert.equal(parseAmount('100', 0), 100)
  assert.deepEqual(estimate(1000000, 'GHS'), {
    receiveMinor: 7997600,
    rate: 80000,
    feeMinor: 300,
  })
  assert.equal(sourceForTarget(7997600, 'GHS'), 1000000)
  assert.equal(estimate(1000000, 'USD').receiveMinor, 999700)
  assert.equal(estimate(1000, 'JPY').receiveMinor, 1050)
  assert.equal(sourceForTarget(1050, 'JPY'), 1000)
  assert.equal(sourceForTarget(0, 'GHS'), undefined)
  assert.throws(() => estimate(399, 'GHS'), /at least/)
})
test('confirmation returns an isolated acknowledgement without changing balances or accounts', () => {
  const balances = { ...INITIAL_BALANCES }
  const account = structuredClone(ghana)
  const q = createQuote(account, 'USDT', 1000000, now, 'quote-1')
  const result = confirmTransfer(
    [account],
    q,
    ' INV-001 ',
    'SUPPLIER_PAYMENT',
    now + 1000,
  )
  assert.equal(result.reference, 'INV-001')
  assert.equal(result.status, 'pending_review')
  assert.deepEqual(INITIAL_BALANCES, balances)
  account.values['payment.creditor.party.name'] = 'Changed later'
  assert.notEqual(
    result.recipient.values['payment.creditor.party.name'],
    'Changed later',
  )
})
test('quote validity lasts 15 minutes from rate issuance, including time spent on transaction details', () => {
  const issued = quote()
  assert.equal(issued.createdAt, now)
  assert.equal(issued.expiresAt, now + 15 * 60_000)
  const detailsElapsed = 10 * 60_000
  assert.equal(issued.expiresAt - (now + detailsElapsed), 5 * 60_000)
  const result = confirmTransfer(
    [ghana],
    issued,
    '',
    'SUPPLIER_PAYMENT',
    issued.expiresAt - 1,
  )
  assert.equal(result.quote.expiresAt, issued.expiresAt)
  assert.throws(
    () =>
      confirmTransfer(
        [ghana],
        issued,
        '',
        'SUPPLIER_PAYMENT',
        issued.expiresAt,
      ),
    /expired/,
  )
})
test('confirmation rejects expired quotes, changed or deleted accounts, and altered calculations', () => {
  assert.throws(
    () =>
      confirmTransfer(
        [ghana],
        quote(),
        '',
        'SUPPLIER_PAYMENT',
        now + 15 * 60_000,
      ),
    /expired/,
  )
  assert.throws(
    () => confirmTransfer([], quote(), '', 'SUPPLIER_PAYMENT', now + 1000),
    /changed|available/,
  )
  assert.throws(
    () =>
      confirmTransfer(
        [{ ...ghana, status: 'pending_review' }],
        quote(),
        '',
        'SUPPLIER_PAYMENT',
        now + 1000,
      ),
    /changed|available/,
  )
  assert.throws(
    () =>
      confirmTransfer(
        [{ ...ghana, updatedAt: '2026-10-01' }],
        quote(),
        '',
        'SUPPLIER_PAYMENT',
        now + 1000,
      ),
    /changed|available/,
  )
  assert.throws(
    () =>
      confirmTransfer(
        [ghana],
        { ...quote(), receiveMinor: 1 },
        '',
        'SUPPLIER_PAYMENT',
        now + 1000,
      ),
    /quote has changed/,
  )
})
test('confirmation enforces the fixed balance without reserving funds for later requests', () => {
  const max = createQuote(ghana, 'USDT', INITIAL_BALANCES.USDT, now, 'max')
  assert.equal(
    confirmTransfer([ghana], max, '', 'SUPPLIER_PAYMENT', now).quote.sendMinor,
    INITIAL_BALANCES.USDT,
  )
  assert.doesNotThrow(() =>
    confirmTransfer([ghana], quote(), '', 'SUPPLIER_PAYMENT', now),
  )
  assert.throws(
    () =>
      confirmTransfer(
        [ghana],
        createQuote(ghana, 'USD', INITIAL_BALANCES.USD + 1, now, 'too-much'),
        '',
        'SUPPLIER_PAYMENT',
        now,
      ),
    /Insufficient/,
  )
})
test('purpose uses the API vocabulary and own-account transfers require matching ownership', () => {
  assert.equal(transactionPurposes.length, 22)
  assert.throws(
    () => confirmTransfer([ghana], quote(), '', 'INVALID', now),
    /purpose/,
  )
  assert.throws(
    () => confirmTransfer([ghana], quote(), '', 'OWN_ACCOUNT_TRANSFER', now),
    /own account/,
  )
  assert.throws(
    () =>
      confirmTransfer(
        [ghana],
        quote(),
        'x'.repeat(141),
        'SUPPLIER_PAYMENT',
        now,
      ),
    /reference/,
  )
  const own = accounts.find((account) => account.relationship === 'own')!
  const q = createQuote(own, 'USD', 10000, now, 'own')
  assert.equal(
    confirmTransfer([own], q, '', 'OWN_ACCOUNT_TRANSFER', now).recipient.id,
    own.id,
  )
})
