// IndexedDB storage. Guides hold step metadata; screenshots live in a
// separate store so editing a step's text doesn't rewrite every image.
import type { Guide, StoredImage } from './types'

const DB_NAME = 'scribe'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('guides')) db.createObjectStore('guides', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error)
      }
    })
  }
  return dbPromise
}

function run<T>(store: 'guides' | 'images', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const getGuide = (id: string) => run<Guide | undefined>('guides', 'readonly', (s) => s.get(id))

export async function listGuides(): Promise<Guide[]> {
  const all = await run<Guide[]>('guides', 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const putGuide = (g: Guide) => run('guides', 'readwrite', (s) => s.put(g))

export async function deleteGuide(id: string): Promise<void> {
  const g = await getGuide(id)
  if (g) {
    for (const step of g.steps) if (step.imageId) await deleteImage(step.imageId)
  }
  await run('guides', 'readwrite', (s) => s.delete(id))
}

export const getImage = (id: string) => run<StoredImage | undefined>('images', 'readonly', (s) => s.get(id))
export const putImage = (img: StoredImage) => run('images', 'readwrite', (s) => s.put(img))
export const deleteImage = (id: string) => run('images', 'readwrite', (s) => s.delete(id))

export async function getImages(ids: string[]): Promise<Record<string, StoredImage>> {
  const out: Record<string, StoredImage> = {}
  await Promise.all(
    ids.map(async (id) => {
      const img = await getImage(id)
      if (img) out[id] = img
    }),
  )
  return out
}
