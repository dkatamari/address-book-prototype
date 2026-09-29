# Axiym address book and send prototype

A standalone, light-themed address book for accounts used for deposits from
and withdrawals to, with a standalone dashboard and demo send flow. Next.js / React / TypeScript,
Tailwind and UI primitives follow `payment-model-prototype`; typography, colours
and the dashboard shell follow `axiym-dashboard-app`. The desktop sidebar is
320 px wide with 16 px semibold navigation and 24 px icons. Content uses 48 px
desktop padding and fills the available width, including account forms. Body,
control and helper typography follow the dashboard’s 16 / 14 / 12 px scale.
Below 1280 px, navigation becomes a drawer and content uses 24 px padding.

## Run

Use Node.js 22.18+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open http://localhost:3002. No API, API key, login service or database is needed.
Dashboard and Address book are enabled in the sidebar. History, Settings and
Sign Out remain visual. The address book remains at `/` and `/recipients/`;
open Dashboard (`/dashboard/`) and choose Send to start the new flow (`/send/`).

For a standalone static build:

```sh
npm run build
npm run preview
```

The `out/` directory can be served by any static web server. The preview script
only serves files. Neither the development nor production app calls a backend.

## Features and storage

- Bank and stablecoin account tabs; own/external account groups.
- Search and destination/ownership filters. Form and filter dropdowns use
  Radix Popover + cmdk searchable comboboxes with keyboard navigation and local
  country, asset and chain icons.
- Add, review, view, copy account details and delete accounts. Saved entries are read-only;
  details open in a full-height right Sheet backed by Radix Dialog, with a
  dimmed backdrop. The Sheet slides in/out while the backdrop fades; reduced-motion
  preferences disable these animations. Radix handles focus trapping, Escape,
  outside dismissal and scroll locking. Closing returns focus to the account row. Close with
  the back arrow, Close button, Escape or backdrop. The drawer shows saved
  bank/wallet details, contacts, ownership, Enabled for and review status.
  Bank country appears once, separate from the party address; drawer rows use
  stable field identifiers rather than display labels as React keys. Wallets
  include an address-copy button and a QR code generated locally from the full
  saved address. Deleting an entry requires confirmation; there is no edit action.
- Add flow: Account Type → Party Details → Account Details → Confirmation.
  Party Details and Account Details badges show account type, ownership and the selected purpose:
  Deposit, Withdraw/Send, or Deposit & Withdraw/Send. No purpose badge appears
  when none is selected. The stablecoin asset is selected in Account Details
  and is not shown as a Party Details badge.
  The first step uses matching selectable cards for ownership and bank/wallet
  type, followed by required account
  purposes (deposit funds from and/or withdraw/send funds to). Purpose choices
  persist with the account and appear in review/details; they are address-book
  metadata, not payment instructions or country-playbook rules. Older records
  without purposes remain readable; adding an account requires at least
  one purpose before leaving Account Type. Next stays disabled until a purpose
  is checked; this step does not show a validation error box. Either purpose or both can be selected. Country is the first selection in bank Account Details; account
  fields appear after a supported country/currency is selected. Account Details
  uses a spacious two-column layout with account number/routing first and a
  full-width Bank Name and Bank Address, followed by SWIFT/BIC; mobile fields stack in one column. The flow uses
  green pill-shaped Next buttons and separate circular Back buttons.
- Own Account prefills and locks the supplied Axi Labs AG business profile;
  External Account supports editable holder, address, email and phone details
  for bank and stablecoin accounts. Holder name, street, country, city, email and phone are required;
  building number, postal code and region are optional. Country of registration is not collected. These are
  address-book requirements layered over the imported playbook rules.
  Required fields use an asterisk, with no optional labels or prefill note.
  Switching ownership restores an external
  draft without copying the own-account profile into it. Contact fields are
  saved and included in confirmation/details. Phone numbers accept a separated
  country code (for example `+65 12345678`), stored as `+65-12345678` to match
  the canonical format. Country-specific additional holder fields appear in Account Details after
  the bank country is selected. China shows required identification type and
  identification number using the internal playbook rule. These fields remain
  editable for Own Account and are validated before confirmation. Changing
  country clears the previous country-specific details while keeping the basic
  Party Details.
- Country-driven bank forms with normalization and local validation.
- Local browser persistence with a versioned storage format. Deleting all
  entries leaves the list empty until the next load, which restores the default accounts.
- When browser storage is missing or contains an empty list, seven fictional Active
  accounts are added and persisted: two stablecoin wallets (Avalanche and Tron),
  two own bank accounts, and three external bank accounts. Defaults include
  addresses, contacts and Enabled for values. Own examples use Axi Labs AG and
  its Swiss business profile, regardless of the bank location. Bank flags use
  the account’s bank country; the address underneath uses the party country.
  Previously saved bundled own examples are refreshed to this profile on load.
  Existing lists are never topped up, and user-created entries are preserved;
  corrupt or inaccessible storage is never replaced with defaults.
- Circular flags/token icons align with account-holder names, with postal
  addresses underneath (14 px names, 12 px addresses). Account numbers show
  their routing identifier or BIC on a separate secondary line. Clearing-code
  labels in the list and bank form use the scheme resolved from the selected
  playbook profile (for example INFSC → IFSC and GH → GIP code), with a generic
  Clearing code fallback for unknown schemes. Existing demo fixtures also display sample addresses;
  user-created records only show their entered address information.

Data is stored under `axiym.address-book.v1` in localStorage for this browser
and origin. It is not shared with other devices. Storage errors are shown and
never treated as successful saves. Use fictional data for this prototype.
The application does not perform payments, account ownership checks, compliance
approval, remote document uploads, or provider verification. Review status is
modeled locally; submitting an account does not contact a review service.

## Country playbooks: source and update workflow

The full Internal Country Playbook source is owned by `axiym-partner-api-docs`:

- `src/data/country-playbooks/index.json` and the indexed country JSON files
- `openapi/internal/payment-model.json`
- `openapi/internal/complementary-info.json`

The public playbook projection and the old payment-model recipient API are not
inputs. Canonical paths remain `payment.creditor.*`; recipient rules are
projected from the full internal expressions without legacy receiver mappings.

After the source repository's normal regeneration:

```sh
npm run sync:playbooks -- --source ../axiym-partner-api-docs
npm test
npm run build
```

The importer validates all source documents before atomically replacing
`src/data/playbooks/snapshot.json`. It reports changed and removed inputs and
records the upstream Git revision, whether relevant files were modified, and
SHA-256 hashes of the JSON contents. A dirty source is explicitly recorded;
content hashes identify the actual imported data. Commit the resulting snapshot.
Never edit it manually. Ordinary builds need only this repository.

```sh
# Check bundled snapshot integrity, with no upstream checkout
npm run check:playbooks
# Compare against a local upstream checkout without importing it
npm run sync:playbooks -- --source ../axiym-partner-api-docs --check
```

Unsupported schema versions, operators, constraints, normalization operations,
and unknown canonical field paths fail the import. The previous snapshot stays
intact. New destinations appear from the index on the next successful import.
Entries saved against an older country or model snapshot display Review details.
Saved entries cannot be edited. To change details, delete the entry and submit a
new account against the current requirements.

## Requirements boundary

`src/app/recipients/lib/requirements.ts` is a pure browser-compatible engine.
It preserves nested allOf/anyOf semantics, keeps routing values as strings
(including leading zeros), applies constants and normalization, and validates
optional fields when entered. Country JSON determines destination requirements;
model definitions provide structural field metadata and identification options.
Name and account identifier are explicit address-book minimums. The prototype
currently captures business account holders.

Recipient requirements conditioned on missing payment facts remain deferred.
It does not assume a sender type, amount or transaction purpose, and does not
turn operational obligations into form fields. A saved record is not a complete
payment execution package. Internal notes stay out of form helper text; forms
use the authored consumer-facing `details` strings, checked by the source
repository before generation. Specific country/currency input hints take
precedence over general regulatory wording for the same field.

Stablecoins are a separate demo capability. USDT and USDC can be saved with
Avalanche or Tron as a network label. Wallet rows show the chain icon and an
address-copy button with success/error feedback. EVM hex or Tron base58
address *format* is checked locally. Network availability, asset support,
checksums, account existence and wallet ownership are not verified. Country
playbooks are not used to infer wallet rules. The bundled Ethereum demo is
updated to Avalanche; existing user-created wallets keep their original chain
and remain readable; replacement accounts must use a supported network.

## Structure

```text
src/app/recipients/       Address book screen, components and pure domain helpers
src/components/ui/       Shared React primitives
src/data/playbooks/       Imported source snapshot and provenance
public/                  Local Axiym assets and Alliance No.2 fonts
scripts/                 Import, verification and static preview
tests/                  Unit and browser regression tests
```

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
```

Browser tests use installed Google Chrome via Playwright and the static export
on port 3002. They cover disabled sidebar items, invalid routing input, add/view/
delete, reload persistence, search, filters, stablecoins, mobile navigation and
absence of external API requests.

## Assets

Country flags are bundled from `country-flag-icons` (MIT; see
`public/flags/LICENSE`) and clipped to circles. USDT/USDC and Avalanche/Tron icons come from the
Axiym dashboard assets. All images and fonts are served locally.

## Interface terminology

Use **Address book** for the collection and **account** for an entry, whether
it is used for deposits from, withdrawals to, or both. Sender and recipient
refer to payment roles, not the name of an address-book entry. Existing route,
component and storage identifiers are retained for compatibility; the stored
account-purpose selections and payment-model paths are unchanged.

Account Details uses neutral Country and Currency labels for accounts that can
be used for deposits or withdrawals. Country/currency choices and routing-code
labels still come from the imported playbooks; this does not claim collection
rail support. Freeform Bank Address and Reason For Adding This Account are
optional address-book metadata, separate from canonical payment data.
Supporting Document accepts a PDF up to 5 MB. Its name and identifier are saved
with the account; the file stays in this browser's IndexedDB and can be downloaded
from account details. Files are persisted only when the account is saved; replacing,
removing or deleting a saved attachment also removes its stored file.

Country-required account owner identification type and number appear directly
below the account-number row, without a separate section heading. Type labels
use readable terminology checked against Payment API 0.1.0's
`PartyIdentificationType` vocabulary (for example Registration number and Tax ID).
The saved values remain the internal canonical codes (`CINC`, `TXID`, etc.) used
by the playbooks. Internal-only types retain their specific readable names;
this display mapping does not convert the record to a public Payment API payload.

Party Details includes a required Relationship selector for external bank accounts
and wallets only, using Payment API 0.1.0 `BusinessRelationship` values. Readable
labels are shown in the form, confirmation and account details; exact API codes
are stored separately from own/external ownership. Switching temporarily to Own
Account hides the field and preserves the external draft selection, but saving
an Own Account omits it. Existing saved records without a relationship still
load; new external accounts require a selection before continuing.

Confirmation groups the entered values into Party Details, Account Details and
Additional Details, with readable country/type names, currency and network icons,
account-type/ownership/purpose badges and Edit links back to each step. The full
address, contacts, external relationship, country-required identification, routing,
bank address, reason and supporting PDF are included when provided. The attachment
can be downloaded before submission. Submit for review persists the account
locally as `pending_review` and shows Account submitted for review with
a Back to address book button. New accounts need approval before they
become `active` and ready to use; there is no automatic approval or backend review
service in this standalone prototype. Bundled demo accounts represent approved
accounts. Older user-created records without a status are treated as pending.
Storage errors keep the form open. Playbook changes retain a separate Review
details warning for previously approved accounts.

Address-book filters use unlabeled visible combo boxes with accessible names for
ownership, country and account purpose. Deposit and Withdraw/Send each include
accounts supporting both; Deposit & Withdraw/Send matches only accounts with both
purposes. Enabled for: All includes older records with no purpose. Purpose filtering
works for banks and wallets, contributes to the filter count and resets with Clear
filters or after submitting an account.

Both bank and stablecoin tables include an Enabled for column with Deposit,
Withdraw/Send, or Deposit & Withdraw/Send. Older accounts without a purpose show
Not specified. The column moves below account details on narrow screens.

Use **Enabled for** for the form legend, table column, filter and saved-account detail
label. The filter defaults to Enabled for: All. Choices remain Deposit, Withdraw/Send
and Deposit & Withdraw/Send; existing `accountPurposes` data and internal helper
names are unchanged.


## Demo send flow

The dashboard and Send screens follow the supplied references and the current
`axiym-dashboard-app` SendView, WorkflowCard and WorkflowSummary patterns:
Select Recipient → Transaction Details → Confirmation → Processing. Dashboard
balances have USD and USDT tabs. Only active bank accounts enabled for Withdraw/Send
are selectable; entries saved under an older playbook revision are excluded.
Send does not support stablecoin wallet destinations. Own and external groups are searchable
and filterable by currency, with bank country flags and party addresses.

Both You send and Recipient gets can drive the calculation. Amounts use integer
minor units and fixed illustrative rates in `src/app/send/lib/transfer.ts`.
USD and USDT each use a 1 USD demo basis; this is not a market rate or an asset
support claim. The fee is 3 source units, included in You send. The minimum is
4 source units; Max uses the currently available demo balance. Target amounts
round to currency precision (JPY/XOF zero decimals, others two); source-based
rounding can affect a target-entered amount, shown explicitly at confirmation.

Purpose labels use the Payment API 0.1.0 TransactionPurpose vocabulary copied
from `axiym-partner-api-docs/openapi/payment-api/0.1.0.yaml`. This is separate from
an address-book entry's Enabled for setting. Reference is optional, up to 140
characters. Supporting PDFs use the existing local 5 MB upload validation and
remain in memory for preview during the current flow; Send does not store them
in IndexedDB.

Quotes are valid for 15 minutes from when the calculated rate first appears in
Transaction Details. The countdown continues through Confirmation and back
navigation; editing reference, purpose or documents does not restart it. A new
amount calculation or explicit refresh issues a new quote. Expiry blocks
progression and submission until the user refreshes and reviews the quote. A
confirmation rechecks the selected account and fixed available balance, then
shows an acknowledgement without the Send heading or workflow step indicator.

Send does not persist requests or supporting files, reserve balances, or display
request history or ongoing progress. The acknowledgement exists only in component
state and is discarded on navigation or reload. Old `axiym.send-demo.v1` data is
ignored. Address-book accounts and their supporting documents keep their existing
persistence. There are no API, OTP, live FX, provider, bank or blockchain calls.
This is not full payment-data preparation: it does not resolve deferred transaction
or provider requirements, create a canonical execution package or execute it.
The source dashboard repository was read for reference and was not modified.

The interface uses customer-facing language throughout: implementation details
about demo data, local storage and playbooks stay in this documentation. Dashboard
colours follow the dashboard app: black text, a purple active currency tab, neutral
action cards and lime action icons.
