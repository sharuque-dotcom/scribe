import { useEffect, useRef, useState, type ReactNode } from 'react'

const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  sparkle: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  back: 'M15 18l-6-6 6-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.1 19.8l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.2 7.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  cap: 'M2 9l10-5 10 5-10 5-10-5zM6 11v5c3 2 9 2 12 0v-5',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  record: 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
  note: 'M12 8v4M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  heading: 'M6 4v16M18 4v16M6 12h12',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  // annotation tools
  pointer: 'M5 3l14 7-6 2-2 6z',
  box: 'M4 6h16v12H4z',
  arrow: 'M5 19L19 5M10 5h9v9',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  marker: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M11 9l1.5-1v8',
  blur: 'M4 4h4v4H4zM12 4h4v4h-4zM8 8h4v4H8zM16 8h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4z',
  spotlight: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2v3M12 19v3M2 12h3M19 12h3',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  target: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
}

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-auto p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Dropdown({ label, icon, children, align = 'right', buttonClass = 'btn-secondary' }: { label: string; icon?: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; buttonClass?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button className={buttonClass} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {icon && <Icon name={icon} />}
        {label}
      </button>
      {open && <div className={`menu ${align === 'right' ? 'right-0' : 'left-0'}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export interface ToastData {
  text: string
  action?: { label: string; run: () => void }
  tone?: 'info' | 'error'
}

export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, toast.tone === 'error' ? 9000 : 6000)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className={`flex items-center gap-4 rounded-lg px-4 py-3 text-sm text-white shadow-soft ${toast.tone === 'error' ? 'bg-rec' : 'bg-ink'}`} role="status">
        <span>{toast.text}</span>
        {toast.action && (
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              toast.action!.run()
              onDone()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Textarea that grows with its content.
export function AutoText({ value, onChange, className = '', placeholder, autoFocus, ariaLabel }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean; ariaLabel?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted/60 ${className}`}
    />
  )
}

export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id

export function timeAgo(t: number): string {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(t).toLocaleDateString()
}
