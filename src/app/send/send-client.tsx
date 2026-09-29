'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiSearchLine,
  RiDownload2Line,
  RiFilePdf2Line,
  RiTimeLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { SendShell } from './components/send-shell'
import { AccountMark, RecipientSummary } from './components/recipient-summary'
import { useRecipients } from '../recipients/lib/use-recipients'
import { parseRecipients, STORAGE_KEY } from '../recipients/lib/storage'
import { NAME, ACCOUNT, BANK } from '../recipients/lib/requirements'
import {
  recipientAddress,
  countryName,
  snapshot,
  ruleRevision,
} from '../recipients/lib/data'
import { routingSummary } from '../recipients/lib/routing'
import { validateDocument, downloadFile } from '../recipients/lib/documents'
import type { Recipient } from '../recipients/lib/types'
import {
  sourceForTarget,
  currencyDigits,
  INITIAL_BALANCES,
  canSendTo,
  confirmTransfer,
  createQuote,
  formatMoney,
  parseAmount,
  purposeName,
  transactionPurposes,
  MIN_SEND_MINOR,
  type FundingCurrency,
  type Quote,
  type Transfer,
} from './lib/transfer'

const steps = [
  'Select Recipient',
  'Transaction Details',
  'Confirmation',
  'Processing',
]
export function SendClient() {
  const router = useRouter()
  const params = useSearchParams()
  const source: FundingCurrency = params.get('from') === 'USD' ? 'USD' : 'USDT'
  const { recipients, ready, error: accountStorageError } = useRecipients()
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState('all')
  const [selected, setSelected] = useState<Recipient>()
  const [amount, setAmount] = useState('10000')
  const [targetAmount, setTargetAmount] = useState<string | undefined>()
  const [reference, setReference] = useState('')
  const [purpose, setPurpose] = useState('')
  const [file, setFile] = useState<File>()
  const [fileError, setFileError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [quote, setQuote] = useState<Quote>()
  const [transfer, setTransfer] = useState<Transfer>()
  const [now, setNow] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileVersion = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const storageError = accountStorageError
  const balance = INITIAL_BALANCES[source]
  const minor = parseAmount(amount)
  const eligible = recipients.filter(
    (r) =>
      canSendTo(r) &&
      !(
        r.kind === 'bank' &&
        r.playbookHash &&
        r.playbookHash !== ruleRevision(r.country)
      ),
  )
  const selectedCurrent = eligible.find((r) => r.id === selected?.id)
  const visible = eligible.filter(
    (r) =>
      (currency === 'all' || r.currency === currency) &&
      [
        r.values[NAME],
        r.values[ACCOUNT],
        r.values[BANK + 'name'],
        countryName(r.country),
        r.currency,
        r.network,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const amountError =
    minor === undefined
      ? 'Enter an amount with no more than two decimal places.'
      : minor < MIN_SEND_MINOR
        ? `The minimum is 4 ${source}, including the fee.`
        : minor > balance
          ? 'This exceeds your available balance.'
          : ''
  const preview =
    quote &&
    quote.sendMinor === minor &&
    quote.source === source &&
    !amountError
      ? quote
      : undefined
  const secondsLeft = quote
    ? Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))
    : 0
  const purposeOptions = transactionPurposes.filter(
    (p) =>
      p.value !== 'OWN_ACCOUNT_TRANSFER' || selected?.relationship === 'own',
  )
  useEffect(() => {
    heading.current?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [step])
  useEffect(() => {
    if (step !== 1 && step !== 2) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [step])
  function choose(account: Recipient, time: number) {
    ++fileVersion.current
    setFileBusy(false)
    setSelected(account)
    setAmount('10000')
    setTargetAmount(undefined)
    setReference('')
    setFile(undefined)
    setFileError('')
    setPurpose(account.relationship === 'own' ? 'OWN_ACCOUNT_TRANSFER' : '')
    setNow(time)
    setQuote(
      balance >= 1000000
        ? createQuote(account, source, 1000000, time, crypto.randomUUID())
        : undefined,
    )
    setError('')
    setStep(1)
  }
  function updateAmount(value: string, time: number) {
    setAmount(value)
    setNow(time)
    setError('')
    const nextMinor = parseAmount(value)
    if (
      !selectedCurrent ||
      nextMinor === undefined ||
      nextMinor < MIN_SEND_MINOR ||
      nextMinor > balance
    ) {
      setQuote(undefined)
      return
    }
    // Only a new calculation issues a new quote; navigating or editing other fields does not.
    if (
      quote?.sendMinor === nextMinor &&
      quote.source === source &&
      quote.recipientVersion === JSON.stringify(selectedCurrent)
    )
      return
    setQuote(
      createQuote(
        selectedCurrent,
        source,
        nextMinor,
        time,
        crypto.randomUUID(),
      ),
    )
  }
  function back() {
    if (busy) return
    setError('')
    if (step === 0 || step === 3) router.push('/dashboard')
    else setStep(step - 1)
  }
  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Check the quote already shown in Transaction Details without restarting its validity.
    const time = Math.round(performance.timeOrigin + event.timeStamp)
    setError('')
    if (!selectedCurrent) {
      setError('This account is no longer available. Choose another recipient.')
      return
    }
    if (amountError || !purpose || fileBusy || fileError) {
      setError(amountError || 'Choose a payment purpose before continuing.')
      return
    }
    setNow(time)
    if (
      !quote ||
      quote.sendMinor !== minor ||
      quote.source !== source ||
      time >= quote.expiresAt
    ) {
      setError('Refresh the quote before continuing.')
      return
    }
    if (quote.recipientVersion !== JSON.stringify(selectedCurrent)) {
      setError('This account has changed. Select it again.')
      return
    }
    setStep(2)
  }
  function refreshQuote(time: number) {
    if (!selectedCurrent || minor === undefined || amountError) {
      setError('Choose an available recipient and enter the amount again.')
      return
    }
    setNow(time)
    setSelected(selectedCurrent)
    setQuote(
      createQuote(selectedCurrent, source, minor, time, crypto.randomUUID()),
    )
    setError('')
  }
  async function selectFile(next?: File) {
    if (!next) return
    const version = ++fileVersion.current
    setFileBusy(true)
    setFileError('')
    try {
      const message = await validateDocument(next)
      if (version !== fileVersion.current) return
      setFile(message ? undefined : next)
      setFileError(message ?? '')
    } catch {
      if (version === fileVersion.current)
        setFileError('Unable to read this document. Choose it again.')
    } finally {
      if (version === fileVersion.current) setFileBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }
  function submit(time: number) {
    if (!quote || submitting.current || step !== 2) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const accounts = parseRecipients(
        localStorage.getItem(STORAGE_KEY) ?? '{"version":1,"recipients":[]}',
      )
      // Keep the acknowledgement only in this flow; transfers and files are not persisted.
      setTransfer(confirmTransfer(accounts, quote, reference, purpose, time))
      setStep(3)
    } catch (cause) {
      submitting.current = false
      setNow(time)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to submit this request. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }
  const backButton = (
    <Button
      type="button"
      className="btn form-back"
      aria-label="Previous step"
      onClick={back}
      disabled={busy}
    >
      <RiArrowLeftLine />
    </Button>
  )
  return (
    <SendShell>
      <div className="form-page send-page">
        <button className="back-link" onClick={back} disabled={busy}>
          <RiArrowLeftLine size={20} />
          Back
        </button>
        <section className="form-panel send-panel">
          {step < 3 && (
            <>
              <div className="send-panel-heading">
                <h1 ref={heading} tabIndex={-1}>
                  Send
                </h1>
              </div>
              <ol className="stepper send-stepper" aria-label="Send progress">
                {steps.map((title, index) => (
                  <li
                    key={title}
                    className={
                      index < step
                        ? 'complete'
                        : index === step
                          ? 'current'
                          : ''
                    }
                    aria-current={step === index ? 'step' : undefined}
                  >
                    <span>
                      {index < step ? <RiCheckLine size={18} /> : index + 1}
                    </span>
                    <strong>{title}</strong>
                  </li>
                ))}
              </ol>
            </>
          )}
          {(error || storageError) && (
            <p className="error-banner" role="alert">
              {error || storageError}
            </p>
          )}
          {step === 0 && (
            <>
              <div className="send-selection-tools">
                <label className="search">
                  <RiSearchLine size={18} />
                  <input
                    placeholder="Search accounts"
                    aria-label="Search send accounts"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <Combobox
                  label="Recipient currency"
                  value={currency}
                  onValueChange={setCurrency}
                  options={[
                    { value: 'all', label: 'All currencies' },
                    ...Array.from(new Set(eligible.map((r) => r.currency)))
                      .sort()
                      .map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
              {!ready ? (
                <p className="loading-state">Loading accounts…</p>
              ) : !visible.length ? (
                <div className="empty-state">
                  <h2>No matching accounts</h2>
                  <p>
                    Try another filter, or add an account to your address book.
                  </p>
                  <Link href="/recipients" className="btn btn-secondary">
                    Go to address book
                  </Link>
                </div>
              ) : (
                (['own', 'external'] as const).map((ownership) => {
                  const rows = visible.filter(
                    (r) => r.relationship === ownership,
                  )
                  return (
                    rows.length > 0 && (
                      <section className="send-account-group" key={ownership}>
                        <h2>
                          {ownership === 'own'
                            ? 'Own Accounts'
                            : 'External Accounts'}
                        </h2>
                        <div className="send-table-heading" aria-hidden="true">
                          <span>Account Holder</span>
                          <span>Account Number / IBAN</span>
                          <span>Bank</span>
                          <span />
                        </div>
                        {rows.map((r) => (
                          <div className="send-account-row" key={r.id}>
                            <div className="send-holder">
                              <AccountMark account={r} />
                              <div>
                                <strong>{r.values[NAME]}</strong>
                                <small title={recipientAddress(r)}>
                                  {recipientAddress(r)}
                                </small>
                              </div>
                            </div>
                            <div className="send-account-cell">
                              <span title={r.values[ACCOUNT]}>
                                {r.values[ACCOUNT]}
                              </span>
                              <small>{routingSummary(snapshot, r)}</small>
                            </div>
                            <div className="send-account-cell">
                              <span>{r.values[BANK + 'name']}</span>
                              <small>
                                {countryName(r.country)} · {r.currency}
                              </small>
                            </div>
                            <button
                              className="send-select"
                              disabled={!!storageError}
                              aria-label={`Select ${r.values[NAME]} ${countryName(r.country)}`}
                              onClick={() => choose(r, Date.now())}
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </section>
                    )
                  )
                })
              )}
            </>
          )}
          {step === 1 && selected && (
            <form onSubmit={handleReview} className="send-columns">
              <div className="send-fields">
                <div className="send-field">
                  <label htmlFor="send-amount">You send</label>
                  <div className="send-amount-control">
                    <input
                      id="send-amount"
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(e) => {
                        updateAmount(e.target.value, Date.now())
                        setTargetAmount(undefined)
                        setError('')
                      }}
                      aria-describedby="send-amount-help"
                      aria-invalid={!!amountError}
                    />
                    <span>{source}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateAmount((balance / 100).toFixed(2), Date.now())
                        setTargetAmount(undefined)
                      }}
                    >
                      Max
                    </button>
                  </div>
                  <p
                    id="send-amount-help"
                    className={
                      amountError ? 'send-field-error' : 'send-field-help'
                    }
                  >
                    {amountError || (
                      <>
                        Minimum: 4 {source} · Available balance:{' '}
                        <strong>
                          {formatMoney(balance, source)} {source}
                        </strong>
                      </>
                    )}
                  </p>
                </div>
                <div className="send-field">
                  <label htmlFor="recipient-gets">Recipient gets</label>
                  <div className="send-amount-control">
                    <span>{selected.currency}</span>
                    <input
                      id="recipient-gets"
                      inputMode="decimal"
                      value={
                        targetAmount ??
                        (preview
                          ? String(
                              preview.receiveMinor /
                                10 ** currencyDigits(selected.currency),
                            )
                          : '')
                      }
                      onChange={(e) => {
                        setTargetAmount(e.target.value)
                        const target = parseAmount(
                          e.target.value,
                          currencyDigits(selected.currency),
                        )
                        const sourceMinor =
                          target === undefined
                            ? undefined
                            : sourceForTarget(target, selected.currency)
                        updateAmount(
                          sourceMinor === undefined
                            ? ''
                            : (sourceMinor / 100).toFixed(2),
                          Date.now(),
                        )
                        setError('')
                      }}
                    />
                  </div>
                  <p className="send-field-help">
                    Enter either amount. The fee is included in the amount you
                    send.
                  </p>
                </div>
                <div className="send-field">
                  <label htmlFor="send-reference">Reference</label>
                  <Input
                    id="send-reference"
                    value={reference}
                    maxLength={140}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="For example, invoice INV-2026-001"
                  />
                </div>
                <div className="send-field">
                  <label id="send-purpose-label">
                    Purpose <span className="required">*</span>
                  </label>
                  <Combobox
                    label="Payment purpose"
                    aria-labelledby="send-purpose-label"
                    value={purpose}
                    onValueChange={setPurpose}
                    options={purposeOptions}
                    placeholder="Choose a payment purpose"
                  />
                </div>
                <div className="send-field">
                  <label htmlFor="send-document">Add supporting document</label>
                  <input
                    ref={fileInput}
                    id="send-document"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => void selectFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    className="document-dropzone"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      void selectFile(e.dataTransfer.files[0])
                    }}
                  >
                    <RiDownload2Line size={42} />
                    <span>
                      {fileBusy ? (
                        'Checking document…'
                      ) : (
                        <>
                          Drop file here or <strong>click to upload</strong>
                        </>
                      )}
                      <small>PDF, up to 5 MB</small>
                    </span>
                  </button>
                  {file && (
                    <div className="document-selected">
                      <RiFilePdf2Line size={20} />
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => downloadFile(file, file.name)}
                      >
                        {file.name}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          ++fileVersion.current
                          setFile(undefined)
                          setFileError('')
                          setFileBusy(false)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {fileError && (
                    <p className="send-field-error" role="alert">
                      {fileError}
                    </p>
                  )}
                </div>
                <div className="form-actions">
                  {backButton}
                  <Button
                    type="submit"
                    className="btn form-next"
                    disabled={
                      !!amountError ||
                      !preview ||
                      !secondsLeft ||
                      !purpose ||
                      !!storageError ||
                      !selectedCurrent ||
                      fileBusy ||
                      !!fileError
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
              <aside className="send-sidebar">
                <section className="send-summary-section">
                  <h2>Calculation</h2>
                  <div className="send-side-card">
                    <dl>
                      <div>
                        <dt>Recipient gets</dt>
                        <dd>
                          {selected.currency}{' '}
                          {preview
                            ? formatMoney(
                                preview.receiveMinor,
                                selected.currency,
                              )
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Fees</dt>
                        <dd>3 {source}</dd>
                      </div>
                      <div>
                        <dt>Rate</dt>
                        <dd>
                          1 {source} = {selected.currency}{' '}
                          {preview ? preview.rate / 10000 : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Quote validity</dt>
                        <dd role="status">
                          {preview
                            ? secondsLeft
                              ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} remaining`
                              : 'This quote has expired.'
                            : '—'}
                        </dd>
                        {preview && !secondsLeft && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => refreshQuote(Date.now())}
                          >
                            Refresh quote
                          </button>
                        )}
                      </div>
                    </dl>
                  </div>
                </section>
                <RecipientSummary account={selected} />
              </aside>
            </form>
          )}
          {step === 2 && selected && quote && (
            <div className="send-columns">
              <div>
                <div className="send-review-amounts">
                  <div>
                    <span>You send</span>
                    <strong>
                      {formatMoney(quote.sendMinor, source)} {source}
                    </strong>
                  </div>
                  <div>
                    <span>Fees included</span>
                    <strong>
                      {formatMoney(quote.feeMinor, source)} {source}
                    </strong>
                  </div>
                  <div>
                    <span>Recipient gets</span>
                    <strong>
                      {quote.currency}{' '}
                      {formatMoney(quote.receiveMinor, quote.currency)}
                    </strong>
                  </div>
                </div>
                <dl className="send-review-lines">
                  <div>
                    <dt>Rate</dt>
                    <dd>
                      1 {source} = {quote.currency} {quote.rate / 10000}
                    </dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>{reference.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{purposeName(purpose)}</dd>
                  </div>
                </dl>
                {file && (
                  <button
                    className="send-file-card"
                    onClick={() => downloadFile(file, file.name)}
                  >
                    <RiFilePdf2Line size={38} />
                    <span>
                      {file.name}
                      <small>
                        {Math.ceil(file.size / 1024)} KB · Download PDF
                      </small>
                    </span>
                  </button>
                )}
                <div
                  className={`send-quote-validity ${!secondsLeft ? 'expired' : ''}`}
                  role="status"
                >
                  <RiTimeLine size={18} />
                  <span>
                    {secondsLeft
                      ? `Quote valid for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                      : 'This quote has expired.'}
                  </span>
                  {!secondsLeft && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => refreshQuote(Date.now())}
                    >
                      Refresh quote
                    </button>
                  )}
                </div>
                {quote.sendMinor > balance && (
                  <p className="error-banner">
                    Your available balance has changed. Return to transaction
                    details and enter a smaller amount.
                  </p>
                )}
                {!selectedCurrent && (
                  <p className="error-banner">
                    This account is no longer available. Return to account
                    selection.
                  </p>
                )}
                <div className="form-actions">
                  {backButton}
                  <Button
                    className="btn form-next"
                    disabled={
                      busy ||
                      !secondsLeft ||
                      !!storageError ||
                      !selectedCurrent ||
                      quote.sendMinor > balance
                    }
                    onClick={() => submit(Date.now())}
                  >
                    {busy ? 'Submitting…' : 'Confirm'}
                  </Button>
                </div>
              </div>
              <aside className="send-sidebar">
                <RecipientSummary account={selected} />
              </aside>
            </div>
          )}
          {step === 3 && transfer && (
            <div className="send-processing" role="status">
              <span className="account-saved-mark">
                <RiTimeLine size={32} />
              </span>
              <h1 ref={heading} tabIndex={-1}>
                Transfer submitted for review
              </h1>
              <p>
                Your request for{' '}
                {formatMoney(transfer.quote.sendMinor, transfer.quote.source)}{' '}
                {transfer.quote.source} to {transfer.recipient.values[NAME]} has
                been submitted.
              </p>
              <dl>
                <div>
                  <dt>Reference</dt>
                  <dd>{transfer.reference || '—'}</dd>
                </div>
                <div>
                  <dt>Recipient gets</dt>
                  <dd>
                    {transfer.quote.currency}{' '}
                    {formatMoney(
                      transfer.quote.receiveMinor,
                      transfer.quote.currency,
                    )}
                  </dd>
                </div>
              </dl>
              <Link className="btn form-next" href="/dashboard">
                Back to dashboard
              </Link>
            </div>
          )}
        </section>
      </div>
    </SendShell>
  )
}
