import { useCallback, useEffect, useRef, useState } from 'react'
import { getGuide, getImages, putGuide } from '../shared/db'
import type { Guide, StoredImage } from '../shared/types'

// Loads a guide and its screenshots, and saves edits shortly after they happen.
// While a guide is still being captured, it refreshes so new steps appear live.
export function useGuide(id: string) {
  const [guide, setGuide] = useState<Guide | null | undefined>(undefined)
  const [images, setImages] = useState<Record<string, StoredImage>>({})
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<Guide | null>(null)

  const requested = useRef(new Set<string>())

  const loadImages = useCallback(async (g: Guide) => {
    const missing = g.steps
      .map((s) => s.imageId)
      .filter((x): x is string => !!x && !requested.current.has(x))
    if (!missing.length) return
    missing.forEach((i) => requested.current.add(i))
    const got = await getImages(missing)
    setImages((p) => ({ ...p, ...got }))
  }, [])

  const reload = useCallback(async () => {
    const g = await getGuide(id)
    setGuide(g ?? null)
    if (g) await loadImages(g)
    return g
  }, [id, loadImages])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (guide?.status !== 'recording') return
    const t = window.setInterval(() => void reload(), 1200)
    return () => window.clearInterval(t)
  }, [guide?.status, reload])

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    if (pending.current) {
      const g = pending.current
      pending.current = null
      await putGuide(g)
    }
  }, [])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void flush()
    }
  }, [flush])

  const update = useCallback(
    (fn: (g: Guide) => Guide) => {
      setGuide((prev) => {
        if (!prev) return prev
        const next = { ...fn(prev), updatedAt: Date.now() }
        pending.current = next
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => void flush(), 350)
        return next
      })
    },
    [flush],
  )

  const addImage = useCallback((img: StoredImage) => {
    requested.current.add(img.id)
    setImages((p) => ({ ...p, [img.id]: img }))
  }, [])

  return { guide, images, update, reload, flush, addImage }
}
