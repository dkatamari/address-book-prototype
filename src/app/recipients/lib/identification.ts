export const IDENTIFICATION_TYPE =
  'payment.creditor.party.identification.identificationType'
export const IDENTIFICATION_NUMBER =
  'payment.creditor.party.identification.identificationId'

// Display terminology checked against Payment API 0.1.0 PartyIdentificationType.
// Values remain canonical internal-model codes for playbook validation. Types
// without an exact public API equivalent retain their internal-model meaning;
// this is a display map, not a conversion to a Payment API request.
const identificationLabels: Record<string, string> = {
  CINC: 'Registration number',
  TXID: 'Tax ID',
  VATN: 'VAT number',
  NIDN: 'National ID',
  CCPT: 'Passport',
  DRLC: "Driver's license",
  ARNU: 'Alien registration number',
  LEIC: 'Legal entity identifier (LEI)',
  IDCD: 'Identity card number',
  CUST: 'Customer number',
  SOCS: 'Social security number',
}
export function displayFieldValue(path: string, value: string): string {
  return path === IDENTIFICATION_TYPE
    ? (identificationLabels[value] ?? value)
    : value
}
