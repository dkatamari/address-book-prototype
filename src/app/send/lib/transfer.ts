import type { Recipient } from '../../recipients/lib/types.ts'
import { accountStatus } from '../../recipients/lib/account-status.ts'

export type FundingCurrency = 'USD' | 'USDT'
export const INITIAL_BALANCES: Record<FundingCurrency, number> = {
  USD: 125000000,
  USDT: 1227003200,
}
export const FEE_MINOR = 300
export const MIN_SEND_MINOR = 400
export const QUOTE_LIFETIME = 15 * 60_000
// Illustrative fixtures, never live rates. Both demo funding assets use a 1 USD basis.
export const DEMO_RATES: Record<string, number> = {
  USD: 10000,
  AED: 36700,
  BDT: 1200000,
  XOF: 6000000,
  CNY: 72000,
  GHS: 80000,
  HKD: 78000,
  IDR: 160000000,
  INR: 830000,
  JPY: 1500000,
  LKR: 3000000,
  MYR: 45000,
  NGN: 15000000,
  PHP: 560000,
  PKR: 2800000,
  QAR: 36400,
  ZAR: 180000,
}
export const currencyDigits = (currency: string) =>
  ['JPY', 'XOF'].includes(currency) ? 0 : 2
export const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: currencyDigits(currency),
  }).format(minor / 10 ** currencyDigits(currency))
export function parseAmount(input: string, digits = 2): number | undefined {
  const pattern = digits === 0 ? /^\d{1,12}$/ : /^\d{1,10}(\.\d{1,2})?$/
  if (!pattern.test(input.trim())) return undefined
  const [whole, fraction = ''] = input.trim().split('.')
  const minor =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'))
  return Number.isSafeInteger(minor) ? minor : undefined
}
// Vocabulary copied from Payment API 0.1.0 TransactionPurpose; labels are presentation copy.
export const transactionPurposes = [
  ['GOODS_PURCHASE', 'Purchase of goods'],
  ['SERVICES_PAYMENT', 'Payment for services'],
  ['SUPPLIER_PAYMENT', 'Supplier payment'],
  ['SALARY_PAYROLL', 'Salary / payroll'],
  ['RENT_LEASE', 'Rent / lease'],
  ['LOAN_DISBURSEMENT', 'Loan disbursement'],
  ['LOAN_REPAYMENT', 'Loan repayment'],
  ['INTEREST_PAYMENT', 'Interest payment'],
  ['INTERCOMPANY_TRANSFER', 'Intercompany transfer'],
  ['OWN_ACCOUNT_TRANSFER', 'Own account transfer'],
  ['TREASURY_MANAGEMENT', 'Treasury management'],
  ['TAX_PAYMENT', 'Tax payment'],
  ['INVESTMENT', 'Investment'],
  ['REAL_ESTATE_PURCHASE', 'Real estate purchase'],
  ['INSURANCE_PAYMENT', 'Insurance payment'],
  ['BUSINESS_EXPENSES', 'Business expenses'],
  ['EDUCATION_TRAINING_FEES', 'Education / training fees'],
  ['SUBSCRIPTION_MEMBERSHIP_FEES', 'Subscription / membership fees'],
  ['ROYALTY_LICENSE_FEES', 'Royalty / licence fees'],
  ['CHARITABLE_DONATION', 'Charitable donation'],
  ['REFUND', 'Refund'],
  ['OTHER', 'Other'],
].map(([value, label]) => ({ value, label }))
export const purposeName = (code: string) =>
  transactionPurposes.find((p) => p.value === code)?.label ?? code
export function canSendTo(account: Recipient) {
  return (
    accountStatus(account) === 'active' &&
    !!account.accountPurposes?.includes('withdraw') &&
    account.kind === 'bank' &&
    !!DEMO_RATES[account.currency]
  )
}
export type Quote = {
  id: string
  recipientId: string
  recipientVersion: string
  source: FundingCurrency
  currency: string
  sendMinor: number
  feeMinor: number
  receiveMinor: number
  rate: number
  createdAt: number
  expiresAt: number
}
export function estimate(sendMinor: number, currency: string) {
  if (!Number.isSafeInteger(sendMinor) || sendMinor < MIN_SEND_MINOR)
    throw new Error('Enter an amount of at least 4.')
  const rate = DEMO_RATES[currency]
  if (!rate) throw new Error('A rate is not available for this currency.')
  const denominator = BigInt(100 * 10000)
  const numerator =
    BigInt(sendMinor - FEE_MINOR) *
    BigInt(rate) *
    BigInt(10 ** currencyDigits(currency))
  const receiveMinor = Number(
    (numerator + denominator / BigInt(2)) / denominator,
  )
  if (!Number.isSafeInteger(receiveMinor))
    throw new Error('This amount is too large.')
  return { receiveMinor, rate, feeMinor: FEE_MINOR }
}
export function sourceForTarget(receiveMinor: number, currency: string) {
  if (
    !Number.isSafeInteger(receiveMinor) ||
    receiveMinor <= 0 ||
    !DEMO_RATES[currency]
  )
    return undefined
  const denominator =
    BigInt(DEMO_RATES[currency]) * BigInt(10 ** currencyDigits(currency))
  const numerator = BigInt(receiveMinor) * BigInt(100 * 10000)
  return Number((numerator + denominator - BigInt(1)) / denominator) + FEE_MINOR
}
export function createQuote(
  account: Recipient,
  source: FundingCurrency,
  sendMinor: number,
  now: number,
  id: string,
): Quote {
  if (!canSendTo(account))
    throw new Error('Choose an active bank account enabled for Withdraw/Send.')
  return {
    id,
    recipientId: account.id,
    recipientVersion: JSON.stringify(account),
    source,
    currency: account.currency,
    sendMinor,
    ...estimate(sendMinor, account.currency),
    createdAt: now,
    expiresAt: now + QUOTE_LIFETIME,
  }
}
export type Transfer = {
  id: string
  status: 'pending_review'
  createdAt: string
  recipient: Recipient
  quote: Quote
  reference: string
  purpose: string
}
export function confirmTransfer(
  accounts: Recipient[],
  quote: Quote,
  reference: string,
  purpose: string,
  now: number,
): Transfer {
  const account = accounts.find((a) => a.id === quote.recipientId)
  if (
    !account ||
    !canSendTo(account) ||
    JSON.stringify(account) !== quote.recipientVersion
  )
    throw new Error(
      'This account has changed or is no longer available. Select it again.',
    )
  if (now >= quote.expiresAt)
    throw new Error('Your quote has expired. Refresh it before confirming.')
  if (quote.sendMinor > INITIAL_BALANCES[quote.source])
    throw new Error('Insufficient available balance. Enter a smaller amount.')
  const expected = createQuote(
    account,
    quote.source,
    quote.sendMinor,
    quote.createdAt,
    quote.id,
  )
  if (JSON.stringify(expected) !== JSON.stringify(quote))
    throw new Error(
      'The quote has changed. Return to transaction details for a new quote.',
    )
  if (reference.trim().length > 140)
    throw new Error('Enter a reference of up to 140 characters.')
  if (!transactionPurposes.some((p) => p.value === purpose))
    throw new Error('Choose a payment purpose.')
  if (purpose === 'OWN_ACCOUNT_TRANSFER' && account.relationship !== 'own')
    throw new Error('Own account transfer requires an own account.')
  const transfer: Transfer = {
    id: quote.id,
    status: 'pending_review',
    createdAt: new Date(now).toISOString(),
    recipient: structuredClone(account),
    quote: { ...quote },
    reference: reference.trim(),
    purpose,
  }
  return transfer
}
