'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { RiArrowRightUpLine } from '@remixicon/react'
import { SendShell } from '../send/components/send-shell'
import {
  INITIAL_BALANCES,
  formatMoney,
  type FundingCurrency,
} from '../send/lib/transfer'
export function DashboardClient() {
  const [currency, setCurrency] = useState<FundingCurrency>('USDT')
  return (
    <SendShell>
      <header className="page-header">
        <h1>Hi, David</h1>
      </header>
      <section className="balance-panel">
        <div
          className="balance-tabs"
          role="tablist"
          aria-label="Balance currency"
        >
          {(['USD', 'USDT'] as const).map((code) => (
            <button
              key={code}
              role="tab"
              aria-selected={currency === code}
              aria-controls="balance-content"
              id={`balance-${code}`}
              onClick={() => setCurrency(code)}
            >
              <Image
                src={code === 'USD' ? '/flags/US.svg' : '/currencies/USDT.svg'}
                width={40}
                height={40}
                alt=""
              />
              {code === 'USD' ? 'US Dollar' : code}
            </button>
          ))}
        </div>
        <div
          className="balance-body"
          role="tabpanel"
          id="balance-content"
          aria-labelledby={`balance-${currency}`}
        >
          <div className="balance-copy">
            <p className="balance-label">Balance</p>
            <p className="balance-amount">
              {formatMoney(INITIAL_BALANCES[currency], currency)}{' '}
              <span>{currency}</span>
            </p>
            <Link className="send-launch" href={`/send/?from=${currency}`}>
              <span>
                <RiArrowRightUpLine size={26} />
              </span>
              Send
            </Link>
          </div>
        </div>
      </section>
    </SendShell>
  )
}
