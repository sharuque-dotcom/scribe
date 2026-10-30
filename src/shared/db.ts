// IndexedDB storage. Guides hold step metadata; screenshots live in a
// separate store so editing a step's text doesn't rewrite every image.
import type { Guide, StoredImage, StoredVideo } from './types'

const DB_NAME = 'scribe'
const DB_VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('guides')) db.createObjectStore('guides', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('voice')) db.createObjectStore('voice', { keyPath: 'key' })
      }
      req.onsuccess = () => {
        const db = req.result
        // Let a newer version of the app upgrade the database (e.g. after an update).
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => {
        dbPromise = null
        reject(req.error)
      }
    })
  }
  return dbPromise
}

type StoreName = 'guides' | 'images' | 'videos' | 'voice'

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
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
    if (g.video) await deleteVideo(g.video.blobId)
  }
  await run('guides', 'readwrite', (s) => s.delete(id))
}

export const getImage = (id: string) => run<StoredImage | undefined>('images', 'readonly', (s) => s.get(id))
export const putImage = (img: StoredImage) => run('images', 'readwrite', (s) => s.put(img))
export const deleteImage = (id: string) => run('images', 'readwrite', (s) => s.delete(id))

export const getVideo = (id: string) => run<StoredVideo | undefined>('videos', 'readonly', (s) => s.get(id))
export const putVideo = (v: StoredVideo) => run('videos', 'readwrite', (s) => s.put(v))
export const deleteVideo = (id: string) => run('videos', 'readwrite', (s) => s.delete(id))

// Generated voice clips, keyed by voice + text, so each sentence is only made once.
export interface VoiceClip {
  key: string
  sampleRate: number
  samples: Float32Array
}
export const getVoiceClip = (key: string) => run<VoiceClip | undefined>('voice', 'readonly', (s) => s.get(key))
export const putVoiceClip = (c: VoiceClip) => run('voice', 'readwrite', (s) => s.put(c))

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
