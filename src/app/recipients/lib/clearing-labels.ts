// Presentation names keyed by the playbook's clearing scheme, never by country
// or by guessing the identifier's format. Unknown schemes stay generic.
const clearingLabels: Record<string, string> = {
  BD: 'Routing number',
  CNAPS: 'CNAPS',
  GH: 'GIP code',
  HKNCC: 'Clearing code',
  ID: 'Bank code',
  INFSC: 'IFSC',
  JPZGN: 'Zengin code',
  LK: 'Bank code',
  NG: 'NIP code',
  PH: 'BRSTN',
  ZANCC: 'Branch code',
}

export function clearingCodeLabel(scheme?: string): string {
  return clearingLabels[scheme ?? ''] ?? 'Clearing code'
}
