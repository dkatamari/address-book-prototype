'use client'
import { useSyncExternalStore } from 'react'
import type { Recipient } from './types'
import { demoRecipients } from './data'
import { loadRecipients, serializeRecipients, STORAGE_KEY } from './storage'
type State = { recipients: Recipient[]; error?: string; ready: boolean }
const server: State = { recipients: [], ready: false }
let cache: State | undefined
const listeners = new Set<() => void>()
function getSnapshot(): State {
  if (cache) return cache
  try {
    cache = {
      recipients: loadRecipients(localStorage, demoRecipients),
      ready: true,
    }
  } catch {
    cache = {
      recipients: [],
      ready: true,
      error: 'Your accounts could not be loaded. Please try again.',
    }
  }
  return cache
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const update = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cache = undefined
      listener()
    }
  }
  window.addEventListener('storage', update)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', update)
  }
}
export function writeRecipients(recipients: Recipient[]) {
  // Persist first: a quota or privacy error must never appear as a successful save.
  localStorage.setItem(STORAGE_KEY, serializeRecipients(recipients))
  cache = { recipients, ready: true }
  listeners.forEach((listener) => listener())
}
export function useRecipients() {
  return useSyncExternalStore(subscribe, getSnapshot, () => server)
}
