import type { SupportingDocument } from './types'

export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024
export async function validateDocument(
  file: File,
): Promise<string | undefined> {
  if (
    !file.name.toLowerCase().endsWith('.pdf') ||
    (file.type && file.type !== 'application/pdf')
  )
    return 'Choose a PDF document.'
  if (file.size > MAX_DOCUMENT_SIZE) return 'Choose a PDF no larger than 5 MB.'
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  if (String.fromCharCode(...header) !== '%PDF-')
    return 'Choose a valid PDF document.'
}
async function documentStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('axiym.address-book.documents', 1)
    request.onupgradeneeded = () =>
      request.result.createObjectStore('documents')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('documents', mode)
      const request = action(transaction.objectStore('documents'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}
export async function storeDocument(document: SupportingDocument, file: File) {
  const error = await validateDocument(file)
  if (error) throw new Error(error)
  await documentStore('readwrite', (store) => store.put(file, document.id))
}
export async function deleteDocument(id: string) {
  await documentStore('readwrite', (store) => store.delete(id))
}
export async function downloadDocument(document: SupportingDocument) {
  const file = await documentStore<Blob | undefined>('readonly', (store) =>
    store.get(document.id),
  )
  if (!file) throw new Error('Document not found')
  downloadFile(file, document.name)
}
export function downloadFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const link = window.document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
