'use client'
import { Fragment, useRef, useState } from 'react'
import {
  RiArrowLeftLine,
  RiBankLine,
  RiBuildingLine,
  RiGroupLine,
  RiCheckLine,
  RiWallet3Line,
  RiDownload2Line,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { AccountConfirmation } from './account-confirmation'
import type { Draft, FormField, Values } from '../lib/types'
import {
  ACCOUNT,
  BANK,
  NAME,
  networks,
  P,
  resolve,
  walletErrors,
} from '../lib/requirements'
import { countryName, destinations, emptyDraft, snapshot } from '../lib/data'
import countries from '../lib/countries'
import {
  businessRelationships,
  businessRelationshipErrors,
  savedBusinessRelationship,
} from '../lib/business-relationship'
import {
  IDENTIFICATION_TYPE,
  IDENTIFICATION_NUMBER,
  displayFieldValue,
} from '../lib/identification'
import { validateDocument } from '../lib/documents'
import {
  partyFields,
  ownPartyValues,
  ownPartyDraft,
  partyValues,
  changeOwnership,
  normalizeContactValues,
  EMAIL,
  PHONE,
} from '../lib/party-details'
import {
  accountPurposes,
  purposeBadge,
  purposeErrors,
  fieldStep,
  valuesForCountryChange,
  stepErrors,
} from '../lib/form-flow'
export function RecipientForm({
  defaultKind,
  cancel,
  save,
}: {
  defaultKind: Draft['kind']
  cancel: () => void
  save: (draft: Draft, file?: File) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    ownPartyDraft(emptyDraft(defaultKind)),
  )
  const externalParty = useRef<Values>({})
  const [step, setStep] = useState(0)
  const [documentFile, setDocumentFile] = useState<File>()
  const [documentError, setDocumentError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Values>({})
  const heading = useRef<HTMLHeadingElement>(null)
  const bank = draft.kind === 'bank'
  const purpose = purposeBadge(draft.accountPurposes)
  const result = bank ? resolve(snapshot, draft) : undefined
  const fields: FormField[] = result?.fields ?? [
    {
      path: ACCOUNT,
      label: 'Wallet address',
      required: true,
      section: 'account',
      hint: 'Enter the wallet address on the selected network.',
    },
    ...partyFields,
  ]
  const accountFields = fields
    .filter((f) => fieldStep(f) === 2)
    .sort((a, b) => {
      const rank = (f: FormField) =>
        f.path === ACCOUNT
          ? 0
          : f.path === BANK + 'clearingSystemMemberId'
            ? 1
            : f.path === IDENTIFICATION_TYPE
              ? 2
              : f.path === IDENTIFICATION_NUMBER
                ? 3
                : f.path === BANK + 'name'
                  ? 4
                  : f.path === BANK + 'bic'
                    ? 5
                    : 6
      return rank(a) - rank(b)
    })
  const allErrors = () => ({
    ...(result?.errors ?? walletErrors(draft)),
    ...businessRelationshipErrors(draft),
    ...purposeErrors(draft.accountPurposes),
  })
  const update = (path: string, value: string) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [path]: value } }))
    setErrors((e) => {
      const next = { ...e }
      delete next[path]
      return next
    })
  }
  function go(next: number) {
    setErrors({})
    setStep(next)
    requestAnimationFrame(() => {
      heading.current?.focus()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
  function next() {
    if (busy || (step === 0 && !purpose)) return
    const issues = stepErrors(step, allErrors(), fields)
    if (Object.keys(issues).length) {
      if (issues.accountPurposes) setStep(0)
      else if (
        step === 2 &&
        Object.keys(stepErrors(1, issues, fields)).length > 0
      )
        setStep(1)
      setErrors(issues)
      return
    }
    if (step === 2 && result)
      setDraft((d) => ownPartyDraft({ ...d, values: result.values }))
    go(step + 1)
  }
  async function submit() {
    if (busy) return
    const issues = allErrors()
    if (Object.keys(issues).length) {
      setStep(
        issues.accountPurposes
          ? 0
          : Object.keys(stepErrors(1, issues, fields)).length
            ? 1
            : 2,
      )
      setErrors(issues)
      return
    }
    setBusy(true)
    try {
      await save(
        {
          ...draft,
          businessRelationship: savedBusinessRelationship(draft),
          values: result?.values ?? {
            ...normalizeContactValues(draft.values),
            [NAME]: draft.values[NAME]?.trim() ?? '',
            [ACCOUNT]: draft.values[ACCOUNT]?.trim() ?? '',
          },
        },
        documentFile,
      )
    } finally {
      setBusy(false)
    }
  }
  async function selectDocument(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const error = await validateDocument(file)
      if (error) {
        setDocumentError(error)
        return
      }
      setDocumentFile(file)
      setDraft((d) => ({
        ...d,
        supportingDocument: {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
        },
      }))
      setDocumentError('')
    } catch {
      setDocumentError('Unable to read this document. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  function bankAddressField() {
    return (
      <div className="form-field field-wide">
        <label htmlFor="bank-address">Bank Address</label>
        <Input
          id="bank-address"
          className="form-input"
          value={draft.bankAddress ?? ''}
          onChange={(e) =>
            setDraft((d) => ({ ...d, bankAddress: e.target.value }))
          }
        />
      </div>
    )
  }
  function chooseCountry(code: string) {
    const currency =
      destinations.find((c) => c.countryCode === code)?.payoutCurrencies[0] ??
      ''
    setDraft((d) => ({
      ...d,
      country: code,
      currency,
      bankAddress: '',
      values: valuesForCountryChange(d.values),
    }))
    setErrors({})
  }
  function renderField(f: FormField) {
    const isCountry =
      f.path.endsWith('.country') ||
      f.path.endsWith('.countryOfResidence') ||
      f.path.endsWith('.issuerCountry')
    const error = errors[f.path]
    const selectOptions = isCountry
      ? countries.map((c) => ({
          value: c.id,
          label: c.name,
          icon: `/flags/${c.id}.svg`,
        }))
      : f.enum?.map((value) => ({
          value,
          label: displayFieldValue(f.path, value).replaceAll('_', ' '),
        }))
    const locked =
      draft.relationship === 'own' && Object.hasOwn(ownPartyValues, f.path)
    const props = {
      disabled: locked,
      id: f.path,
      value: draft.values[f.path] ?? '',
      'aria-invalid': !!error,
      'aria-required': f.required,
      'aria-describedby': `${f.path}-help`,
    }
    return (
      <div
        className={`form-field ${f.path === NAME || f.path === BANK + 'name' || (!bank && f.path === ACCOUNT) ? 'field-wide' : ''}`}
        key={f.path}
      >
        <label htmlFor={f.path}>
          {f.label}
          {f.required && <span className="required"> *</span>}
        </label>
        {selectOptions ? (
          <Combobox
            {...props}
            label={f.label}
            options={selectOptions}
            onValueChange={(value) => update(f.path, value)}
            placeholder={`Select ${f.label.toLowerCase()}`}
            clearable={!f.required}
          />
        ) : (
          <Input
            {...props}
            className="form-input"
            type={
              f.path === EMAIL ? 'email' : f.path === PHONE ? 'tel' : 'text'
            }
            autoComplete={
              f.path === EMAIL ? 'email' : f.path === PHONE ? 'tel' : 'off'
            }
            onChange={(e) => update(f.path, e.target.value)}
            placeholder={
              f.path === ACCOUNT
                ? bank
                  ? 'Enter account number or IBAN'
                  : draft.network === 'Tron'
                    ? 'T…'
                    : '0x…'
                : undefined
            }
          />
        )}
        <div id={`${f.path}-help`}>
          {error ? (
            <p className="field-error">{error}</p>
          ) : (
            f.hint && <p className="field-hint">{f.hint}</p>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="form-page">
      <button className="back-link" onClick={cancel}>
        <RiArrowLeftLine size={18} />
        Back
      </button>
      <section
        className={`form-panel ${step === 0 ? 'account-type-panel' : step === 1 ? 'party-details-panel' : step === 2 ? 'account-details-panel' : 'confirmation-panel'}`}
      >
        <h1 ref={heading} tabIndex={-1}>
          Add account
        </h1>
        <ol className="stepper">
          {[
            'Account Type',
            'Party Details',
            'Account Details',
            'Confirmation',
          ].map((name, i) => (
            <li
              className={i === step ? 'current' : i < step ? 'complete' : ''}
              key={name}
              aria-current={i === step ? 'step' : undefined}
            >
              <span>{i < step ? <RiCheckLine size={16} /> : i + 1}</span>
              <strong>{name}</strong>
            </li>
          ))}
        </ol>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 3) submit()
            else next()
          }}
        >
          {step === 0 && (
            <>
              <div className="form-field">
                <label>Account Ownership</label>
                <div
                  className="type-cards"
                  role="group"
                  aria-label="Account ownership"
                >
                  {(['own', 'external'] as const).map((value) => (
                    <button
                      type="button"
                      aria-pressed={draft.relationship === value}
                      className={`type-card ${draft.relationship === value ? 'selected' : ''}`}
                      aria-label={
                        value === 'own' ? 'Own Account' : 'External Account'
                      }
                      key={value}
                      onClick={() => {
                        if (draft.relationship === value) return
                        if (draft.relationship === 'external')
                          externalParty.current = partyValues(draft.values)
                        setDraft(
                          changeOwnership(draft, value, externalParty.current),
                        )
                        setErrors({})
                      }}
                    >
                      {value === 'own' ? <RiBuildingLine /> : <RiGroupLine />}
                      <strong>
                        {value === 'own' ? 'Own Account' : 'External Account'}
                      </strong>
                      <span>
                        {value === 'own'
                          ? 'An account belonging to your business.'
                          : 'An account belonging to someone else.'}
                      </span>
                      <i>
                        {draft.relationship === value && (
                          <RiCheckLine size={14} />
                        )}
                      </i>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field account-type-label">
                <label>Account Type</label>
              </div>
              <div
                className="type-cards"
                role="group"
                aria-label="Account type"
              >
                {(['bank', 'stablecoin'] as const).map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    aria-pressed={draft.kind === kind}
                    className={`type-card ${draft.kind === kind ? 'selected' : ''}`}
                    onClick={() => {
                      setDraft((d) => ({
                        ...emptyDraft(kind),
                        relationship: d.relationship,
                        businessRelationship: d.businessRelationship,
                        accountPurposes: d.accountPurposes,
                        accountReason: d.accountReason,
                        supportingDocument: d.supportingDocument,
                        values: Object.fromEntries(
                          Object.entries(d.values).filter(([p]) =>
                            p.startsWith(P + 'party.'),
                          ),
                        ),
                      }))
                      setErrors({})
                    }}
                  >
                    {kind === 'bank' ? <RiBankLine /> : <RiWallet3Line />}
                    <strong>
                      {kind === 'bank' ? 'Bank account' : 'Stablecoin wallet'}
                    </strong>
                    <span>
                      {kind === 'bank'
                        ? 'Local currency, country-specific details.'
                        : 'Save a wallet address and network.'}
                    </span>
                    <i>{draft.kind === kind && <RiCheckLine size={14} />}</i>
                  </button>
                ))}
              </div>
              <fieldset className="account-purpose">
                <legend>
                  Enabled for <span className="required">*</span>
                </legend>
                <div className="purpose-options">
                  {accountPurposes.map(({ value, label }) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={
                          draft.accountPurposes?.includes(value) ?? false
                        }
                        onChange={(event) => {
                          setDraft((d) => ({
                            ...d,
                            accountPurposes: event.target.checked
                              ? [...(d.accountPurposes ?? []), value]
                              : (d.accountPurposes ?? []).filter(
                                  (p) => p !== value,
                                ),
                          }))
                          setErrors((e) => {
                            const next = { ...e }
                            delete next.accountPurposes
                            return next
                          })
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {(step === 1 || step === 2) && (
            <>
              <div className="context-pills">
                <span>{bank ? 'Bank account' : 'Stablecoin wallet'}</span>
                {bank && draft.country && (
                  <span>
                    {countryName(draft.country)} · {draft.currency}
                  </span>
                )}
                <span>
                  {draft.relationship === 'own'
                    ? 'Own account'
                    : 'External account'}
                </span>
                {purpose && <span>{purpose}</span>}
              </div>
              {step === 1 && draft.relationship === 'external' && (
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="business-relationship">
                      Relationship <span className="required">*</span>
                    </label>
                    <Combobox
                      id="business-relationship"
                      label="Relationship"
                      value={draft.businessRelationship ?? ''}
                      placeholder="Select a relationship"
                      options={[...businessRelationships]}
                      aria-required
                      aria-invalid={!!errors.businessRelationship}
                      aria-describedby="business-relationship-error"
                      onValueChange={(businessRelationship) => {
                        setDraft((d) => ({ ...d, businessRelationship }))
                        setErrors((e) => {
                          const next = { ...e }
                          delete next.businessRelationship
                          return next
                        })
                      }}
                    />
                    {errors.businessRelationship && (
                      <p
                        id="business-relationship-error"
                        className="field-error"
                      >
                        {errors.businessRelationship}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {bank && step === 2 && (
                <div className="form-grid setup-fields">
                  <div className="form-field">
                    <label htmlFor="account-country">
                      Country <span className="required">*</span>
                    </label>
                    <Combobox
                      id="account-country"
                      label="Country"
                      value={draft.country}
                      onValueChange={chooseCountry}
                      placeholder="Select a country"
                      aria-invalid={!!errors.country}
                      aria-required
                      options={destinations.map((c) => ({
                        value: c.countryCode,
                        label: c.countryName,
                        icon: `/flags/${c.countryCode}.svg`,
                      }))}
                    />
                    {errors.country && (
                      <p className="field-error">{errors.country}</p>
                    )}
                  </div>
                  <div className="form-field">
                    <label htmlFor="account-currency">
                      Currency <span className="required">*</span>
                    </label>
                    <Combobox
                      id="account-currency"
                      label="Currency"
                      aria-required
                      value={draft.currency}
                      disabled={!draft.country}
                      placeholder="Select a country first"
                      onValueChange={(currency) =>
                        setDraft((d) => ({ ...d, currency }))
                      }
                      options={(
                        snapshot.playbooks[draft.country]?.paymentMethods.find(
                          (m) => m.id === 'BANK',
                        )?.payoutCurrencies ?? []
                      ).map((c) => ({
                        value: c.currency.code,
                        label: `${c.currency.name} (${c.currency.code})`,
                      }))}
                    />
                  </div>
                </div>
              )}
              {!bank && step === 2 && (
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="asset">Stablecoin</label>
                    <Combobox
                      id="asset"
                      label="Stablecoin"
                      value={draft.currency}
                      onValueChange={(currency) =>
                        setDraft((d) => ({ ...d, currency }))
                      }
                      options={['USDT', 'USDC'].map((value) => ({
                        value,
                        label: value,
                        icon: `/currencies/${value}.svg`,
                      }))}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="network">Network</label>
                    <Combobox
                      id="network"
                      label="Network"
                      value={draft.network}
                      aria-invalid={!!errors.network}
                      onValueChange={(network) =>
                        setDraft((d) => ({ ...d, network }))
                      }
                      options={networks.map((value) => ({
                        value,
                        label: value,
                        icon: `/chains/${value.toUpperCase()}.svg`,
                      }))}
                    />
                    {errors.network && (
                      <p className="field-error">{errors.network}</p>
                    )}
                  </div>
                </div>
              )}
              {(step === 1 || !bank || result?.supported) && (
                <div className="form-grid">
                  {(step === 2
                    ? accountFields
                    : fields.filter((f) => fieldStep(f) === 1)
                  ).map((field) =>
                    bank && step === 2 && field.path === BANK + 'name' ? (
                      <Fragment key={field.path}>
                        {renderField(field)}
                        {bankAddressField()}
                      </Fragment>
                    ) : (
                      renderField(field)
                    ),
                  )}
                </div>
              )}
              {step === 2 && (!bank || result?.supported) && (
                <div className="form-grid account-extras">
                  <div className="form-field field-wide">
                    <label htmlFor="account-reason">
                      Reason For Adding This Account
                    </label>
                    <Input
                      id="account-reason"
                      className="form-input"
                      value={draft.accountReason ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          accountReason: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field field-wide">
                    <label htmlFor="supporting-document">
                      Supporting Document
                    </label>
                    <input
                      ref={fileInput}
                      id="supporting-document"
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={busy}
                      onChange={(e) => {
                        void selectDocument(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      className="document-dropzone"
                      disabled={busy}
                      onClick={() => fileInput.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (!busy) void selectDocument(e.dataTransfer.files[0])
                      }}
                    >
                      <RiDownload2Line size={40} aria-hidden="true" />
                      <span>
                        Drop file here or <strong>click to upload</strong>
                        <small>PDF, up to 5 MB</small>
                      </span>
                    </button>
                    {draft.supportingDocument && (
                      <div className="document-selected">
                        <span>{draft.supportingDocument.name}</span>
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            setDocumentFile(undefined)
                            setDraft((d) => ({
                              ...d,
                              supportingDocument: undefined,
                            }))
                            setDocumentError('')
                          }}
                        >
                          Remove document
                        </button>
                      </div>
                    )}
                    {documentError && (
                      <p className="field-error" role="alert">
                        {documentError}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {step === 2 && result && result.deferred.length > 0 && (
                <p className="quiet-note">
                  Some account requirements depend on the eventual payment.
                  These will need checking when preparing that payment.
                </p>
              )}
            </>
          )}
          {step === 3 && (
            <AccountConfirmation
              draft={draft}
              fields={[
                ...fields.filter((f) => fieldStep(f) === 1),
                ...accountFields,
              ]}
              file={documentFile}
              edit={go}
              busy={busy}
            />
          )}
          {step > 0 && Object.keys(errors).length > 0 && (
            <div className="error-banner" role="alert">
              {Object.entries(errors)
                .filter(([p]) => p.startsWith('rule:'))
                .map(([p, e]) => (
                  <p key={p}>{e}</p>
                ))}
              Please check the highlighted fields before continuing.
            </div>
          )}
          <div
            className={`form-actions ${step === 0 ? 'first-step-actions' : ''}`}
          >
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="btn form-back"
                disabled={busy}
                aria-label="Back"
                title="Back"
                onClick={() => go(step - 1)}
              >
                <RiArrowLeftLine size={24} />
              </Button>
            )}
            <Button
              className="btn form-next"
              type="submit"
              disabled={busy || (step === 0 && !purpose)}
            >
              {busy && step === 3
                ? 'Submitting…'
                : step === 3
                  ? 'Submit for review'
                  : 'Next'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
