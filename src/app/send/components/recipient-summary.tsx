import Image from 'next/image'
import type { Recipient } from '../../recipients/lib/types'
import { NAME, ACCOUNT, BANK } from '../../recipients/lib/requirements'
import {
  countryName,
  recipientAddress,
  snapshot,
} from '../../recipients/lib/data'
import { routingSummary } from '../../recipients/lib/routing'
export function AccountMark({
  account,
  size = 32,
}: {
  account: Recipient
  size?: number
}) {
  return (
    <Image
      src={
        account.kind === 'bank'
          ? `/flags/${account.country}.svg`
          : `/currencies/${account.currency}.svg`
      }
      alt={
        account.kind === 'bank'
          ? countryName(account.country)
          : account.currency
      }
      width={size}
      height={size}
      className="send-account-mark"
    />
  )
}
export function RecipientSummary({ account }: { account: Recipient }) {
  const bank = account.kind === 'bank'
  return (
    <section className="send-summary-section">
      <h2>Recipient</h2>
      <div className="send-side-card">
        <AccountMark account={account} size={36} />
        <h3>{account.values[NAME]}</h3>
        <dl>
          <div>
            <dt>Address</dt>
            <dd>{recipientAddress(account)}</dd>
          </div>
          <div>
            <dt>{bank ? 'Account Number / IBAN' : 'Wallet Address'}</dt>
            <dd>{account.values[ACCOUNT]}</dd>
          </div>
          {bank ? (
            <>
              <div>
                <dt>Bank identifier</dt>
                <dd>{routingSummary(snapshot, account)}</dd>
              </div>
              <div>
                <dt>Bank</dt>
                <dd>{account.values[BANK + 'name'] || 'Bank account'}</dd>
              </div>
              <div>
                <dt>Bank country</dt>
                <dd>{countryName(account.country)}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>Network</dt>
              <dd className="wallet-network">
                <Image
                  src={`/chains/${account.network.toUpperCase()}.svg`}
                  width={18}
                  height={18}
                  alt=""
                />
                {account.network}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
