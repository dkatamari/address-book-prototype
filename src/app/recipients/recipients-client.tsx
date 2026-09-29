'use client'
import { useEffect, useState } from 'react'
import {
  RiAddLine,
  RiSearchLine,
  RiFilter3Line,
  RiMenuLine,
  RiArrowRightUpLine,
  RiCheckLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Sidebar } from './components/sidebar'
import { RecipientList } from './components/recipient-list'
import { RecipientForm } from './components/recipient-form'
import { AccountSaved } from './components/account-saved'
import { Modal } from './components/modal'
import { AccountDrawer } from './components/account-drawer'
import { useRecipients, writeRecipients } from './lib/use-recipients'
import { countryName, destinations, snapshot, ruleRevision } from './lib/data'
import { ACCOUNT, BANK, NAME } from './lib/requirements'
import { submitForReview } from './lib/account-status'
import { matchesPurpose, purposeFilters } from './lib/filters'
import { storeDocument, deleteDocument } from './lib/documents'
import type { Draft, Recipient } from './lib/types'
export function RecipientsClient() {
  const { recipients, ready, error: storageError } = useRecipients()
  const [tab, setTab] = useState<Draft['kind']>('bank')
  const [search, setSearch] = useState('')
  const [relationship, setRelationship] = useState('all')
  const [country, setCountry] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [form, setForm] = useState<'new' | null>(null)
  const [saved, setSaved] = useState<Recipient | null>(null)
  const [detail, setDetail] = useState<Recipient | null>(null)
  const [deleting, setDeleting] = useState<Recipient | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4500)
      return () => clearTimeout(t)
    }
  }, [message])
  const filtered = recipients.filter(
    (r) =>
      r.kind === tab &&
      (relationship === 'all' || r.relationship === relationship) &&
      matchesPurpose(r.accountPurposes, purpose) &&
      (country === 'all' || tab === 'stablecoin' || r.country === country) &&
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
  const filterCount =
    Number(relationship !== 'all') +
    Number(country !== 'all' && tab === 'bank') +
    Number(purpose !== 'all')
  const add = () => {
    setError('')
    setForm('new')
  }
  async function save(draft: Draft, file?: File) {
    const now = new Date().toISOString()
    const r: Recipient = {
      ...submitForReview(draft),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...(draft.kind === 'bank'
        ? { playbookHash: ruleRevision(draft.country) }
        : {}),
    }
    try {
      if (storageError) throw new Error('Storage unavailable')
      if (file && draft.supportingDocument)
        await storeDocument(draft.supportingDocument, file)
      writeRecipients([...recipients, r])
      setForm(null)
      setSaved(r)
      setTab(draft.kind)
      setCountry('all')
      setRelationship('all')
      setPurpose('all')
      setSearch('')
      setMessage('')
      setError('')
    } catch {
      if (file && draft.supportingDocument)
        void deleteDocument(draft.supportingDocument.id).catch(() => {})
      setError(
        'Unable to save in this browser. Check storage permissions or available space, then try again.',
      )
    }
  }
  function remove() {
    if (!deleting) return
    try {
      writeRecipients(recipients.filter((r) => r.id !== deleting.id))
      if (deleting.supportingDocument)
        void deleteDocument(deleting.supportingDocument.id).catch(() => {})
      setDeleting(null)
      setDetail(null)
      setMessage('Account deleted')
    } catch {
      setError('Unable to delete from browser storage. Please try again.')
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setError('')
      setMessage('Copied to clipboard')
    } catch {
      setError(
        'Clipboard unavailable. Select and copy the account details manually.',
      )
    }
  }
  return (
    <div className="app-shell">
      <Sidebar
        onRecipients={() => {
          setForm(null)
          setSaved(null)
          setDetail(null)
        }}
        open={sidebarOpen}
        close={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        <div className="mobile-bar">
          <button
            className="icon-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <RiMenuLine />
          </button>
          <span>axiym</span>
        </div>
        {(error || storageError) && (
          <div className="error-banner" role="alert">
            {error || storageError}
            <button className="text-button" onClick={() => setError('')}>
              Dismiss
            </button>
          </div>
        )}
        {saved ? (
          <AccountSaved account={saved} back={() => setSaved(null)} />
        ) : form ? (
          <RecipientForm
            defaultKind={tab}
            cancel={() => {
              setForm(null)
              setError('')
            }}
            save={save}
          />
        ) : (
          <>
            <header className="page-header">
              <div>
                <h1>Address book</h1>
              </div>
              <Button
                className="btn"
                onClick={add}
                disabled={!ready || !!storageError}
              >
                <RiAddLine size={18} />
                Add account
              </Button>
            </header>
            <div className="list-toolbar">
              <div className="tabs" role="tablist" aria-label="Account type">
                {(['bank', 'stablecoin'] as const).map((kind) => (
                  <button
                    role="tab"
                    aria-selected={tab === kind}
                    aria-controls="recipient-results"
                    id={`tab-${kind}`}
                    key={kind}
                    className={tab === kind ? 'active' : ''}
                    onClick={() => {
                      setTab(kind)
                      setCountry('all')
                    }}
                  >
                    {kind === 'bank' ? 'Bank Accounts' : 'Stablecoin Accounts'}
                    <span>
                      {recipients.filter((r) => r.kind === kind).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="search-and-filter">
                <label className="search">
                  <RiSearchLine size={18} />
                  <input
                    aria-label="Search accounts"
                    placeholder="Search accounts"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  className={`filter-button ${filterOpen || filterCount ? 'selected' : ''}`}
                  onClick={() => setFilterOpen((v) => !v)}
                  aria-expanded={filterOpen}
                >
                  <RiFilter3Line size={17} />
                  Filters{filterCount > 0 && <span>{filterCount}</span>}
                </button>
              </div>
            </div>
            {filterOpen && (
              <div className="filter-panel">
                <div className="filter-control">
                  <Combobox
                    label="Filter ownership"
                    value={relationship}
                    onValueChange={setRelationship}
                    options={[
                      { value: 'all', label: 'All accounts' },
                      { value: 'own', label: 'Own accounts' },
                      { value: 'external', label: 'External accounts' },
                    ]}
                  />
                </div>
                {tab === 'bank' && (
                  <div className="filter-control">
                    <Combobox
                      label="Filter country"
                      value={country}
                      onValueChange={setCountry}
                      options={[
                        { value: 'all', label: 'All countries' },
                        ...destinations.map((c) => ({
                          value: c.countryCode,
                          label: c.countryName,
                          icon: `/flags/${c.countryCode}.svg`,
                        })),
                      ]}
                    />
                  </div>
                )}
                <div className="filter-control purpose-filter">
                  <Combobox
                    label="Filter enabled for"
                    value={purpose}
                    onValueChange={setPurpose}
                    options={purposeFilters}
                  />
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setRelationship('all')
                    setCountry('all')
                    setPurpose('all')
                    setSearch('')
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            <div
              role="tabpanel"
              id="recipient-results"
              aria-labelledby={`tab-${tab}`}
            >
              {ready ? (
                <RecipientList
                  items={filtered}
                  open={setDetail}
                  remove={setDeleting}
                  add={add}
                  copy={copy}
                />
              ) : (
                <div className="loading-state">Loading your address book…</div>
              )}
            </div>
            <footer className="page-footer">
              <span>
                <span className="local-dot" />
                Stored in this browser · Demo entries are fictional
              </span>
              <span>
                {tab === 'bank'
                  ? `${destinations.length} countries · Playbooks v${snapshot.index.version}`
                  : 'Wallet address format checks · No network connection'}
              </span>
            </footer>
          </>
        )}
      </main>
      {message && (
        <div className="toast" role="status">
          <RiCheckLine size={18} />
          {message}
        </div>
      )}
      {detail && (
        <AccountDrawer
          key={detail.id}
          account={detail}
          close={() => setDetail(null)}
          remove={() => {
            setDeleting(detail)
            setDetail(null)
          }}
        />
      )}
      {deleting && (
        <Modal title="Delete account?" close={() => setDeleting(null)}>
          <p className="delete-description">
            Remove <strong>{deleting.values[NAME]}</strong> from this browser’s
            address book? This cannot be undone.
          </p>
          <div className="modal-actions">
            <Button
              className="btn btn-secondary"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Keep account
            </Button>
            <button className="btn btn-danger" onClick={remove}>
              Delete account
              <RiArrowRightUpLine size={17} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
