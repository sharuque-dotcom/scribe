// The frame around every editor page: a sidebar with navigation, recent guides
// and the upgrade card, plus the plans window and Settings, which any page can open.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { listGuides } from '../../shared/db'
import type { CaptureMode, Guide } from '../../shared/types'
import { focusSearch, newBlankGuide, openPlans, openSettings, startCapture } from '../actions'
import { Icon, Toast, type ToastData } from '../ui'
import { usePlan } from '../usePlan'
import { PlansDialog } from './PlansDialog'
import { SettingsDialog } from './Settings'

type Kind = 'guide' | 'both' | 'video'
const kindOf = (g: Guide): Kind => (g.mode === 'video' && g.video ? 'video' : g.video ? 'both' : 'guide')
const KIND: Record<Kind, { icon: string; color: string; label: string }> = {
  guide: { icon: 'file', color: '#2563eb', label: 'Guide' },
  both: { icon: 'doc', color: '#ea580c', label: 'Guide + video' },
  video: { icon: 'video', color: '#7c3aed', label: 'Video' },
}

const NEW: { id: CaptureMode | 'blank'; label: string; hint: string; icon: string; color: string }[] = [
  { id: 'screenshots', label: 'Guide', hint: 'A screenshot for every click', icon: 'file', color: '#2563eb' },
  { id: 'both', label: 'Guide + video', hint: 'Plus a narrated video', icon: 'doc', color: '#ea580c' },
  { id: 'video', label: 'Video', hint: 'Auto-zoom, captions, voice', icon: 'video', color: '#7c3aed' },
  { id: 'blank', label: 'Blank guide', hint: 'Write one from scratch', icon: 'pen', color: '#db2777' },
]

const remembered = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: just don't remember.
  }
}

// The StepCrumb mark: three crumbs rising.
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#151412" />
      <circle cx="18" cy="44" r="6" fill="#F97316" />
      <circle cx="32" cy="32" r="7.5" fill="#FAF8F4" />
      <circle cx="46" cy="18" r="9" fill="#818CF8" />
    </svg>
  )
}

function NewMenu({ collapsed, onToast }: { collapsed: boolean; onToast: (t: ToastData) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  const pick = async (id: CaptureMode | 'blank') => {
    setBusy(id)
    try {
      if (id === 'blank') await newBlankGuide()
      else {
        const err = await startCapture(id)
        if (err) onToast({ text: err, tone: 'error' })
      }
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }
  return (
    <div className="relative" ref={ref}>
      <button className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="New">
        <Icon name="plus" className="h-[18px] w-[18px]" />
        {!collapsed && 'New'}
      </button>
      {open && (
        <div className={`absolute z-40 mt-1 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-float ${collapsed ? 'left-full top-0 ml-2 mt-0' : 'left-0'}`} role="menu">
          {NEW.map((n) => (
            <button key={n.id} role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-raised disabled:opacity-60" disabled={!!busy} onClick={() => void pick(n.id)}>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg" style={{ background: `${n.color}14`, color: n.color }}>
                <Icon name={busy === n.id ? 'record' : n.icon} className={`h-4 w-4 ${busy === n.id ? 'animate-pulse' : ''}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{n.label}</span>
                <span className="block text-xs text-muted">{busy === n.id ? 'Starting…' : n.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UpgradeCard({ collapsed }: { collapsed: boolean }) {
  const { pro, ready, plan } = usePlan()
  if (!ready) return null
  if (pro)
    return (
      <button className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`} onClick={openPlans} title="Your plan">
        <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-green-600 text-white">
          <Icon name="check" className="h-3 w-3" />
        </span>
        {!collapsed && <span className="truncate">{plan}</span>}
      </button>
    )
  if (collapsed)
    return (
      <button className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent hover:bg-accent/15" onClick={openPlans} title="Upgrade to Pro" aria-label="Upgrade to Pro">
        <Bolt />
      </button>
    )
  return (
    <button onClick={openPlans} className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left shadow-[0_1px_2px_rgb(21_20_18/0.05)] transition hover:-translate-y-px hover:shadow-soft" aria-label="Upgrade to Pro">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Upgrade to Pro</span>
        <span className="block text-[13px] text-muted">Unlock more features</span>
      </span>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/10 text-accent transition group-hover:bg-accent group-hover:text-white">
        <Bolt />
      </span>
    </button>
  )
}

const Bolt = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
    <path d="M13.5 2 4 14h7l-1 8 9.5-12h-7l1-8z" />
  </svg>
)

function Sidebar({ collapsed, onToggle, current, onNavigate, onToast }: { collapsed: boolean; onToggle?: () => void; current?: string; onNavigate?: () => void; onToast: (t: ToastData) => void }) {
  const [guides, setGuides] = useState<Guide[]>([])
  useEffect(() => {
    const load = () => listGuides().then(setGuides).catch(() => {})
    void load()
    const t = window.setInterval(load, 3000)
    return () => window.clearInterval(t)
  }, [])
  const recent = [...guides].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  const atLibrary = !current
  const item = (extra = '') => `nav-item ${collapsed ? 'justify-center px-0' : ''} ${extra}`
  return (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="StepCrumb">
      <div className={`mb-3 flex items-center gap-2.5 px-1 ${collapsed ? 'flex-col' : ''}`}>
        <a href="#/" onClick={onNavigate} className="flex items-center gap-2.5" aria-label="StepCrumb library">
          <Logo className="h-8 w-8 flex-none" />
          {!collapsed && <span className="text-[17px] font-semibold tracking-tight">StepCrumb</span>}
        </a>
        {onToggle && (
          <button className={`icon-btn ${collapsed ? '' : 'ml-auto'}`} onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}
      </div>
      <NewMenu collapsed={collapsed} onToast={onToast} />
      <button
        className={item()}
        title="Search"
        onClick={() => {
          onNavigate?.()
          if (location.hash !== '#/' && location.hash !== '') location.hash = '#/'
          setTimeout(focusSearch, 50)
        }}
      >
        <Icon name="search" className="h-[18px] w-[18px]" />
        {!collapsed && 'Search'}
      </button>
      <a href="#/" onClick={onNavigate} className={item(atLibrary ? 'active' : '')} title="Library">
        <Icon name="grid" className="h-[18px] w-[18px]" />
        {!collapsed && (
          <>
            <span className="flex-1">Library</span>
            <span className="text-xs tabular-nums text-muted">{guides.length || ''}</span>
          </>
        )}
      </a>

      {!collapsed && recent.length > 0 && (
        <>
          <p className="mb-1 mt-5 px-2.5 text-xs font-medium text-muted">Recent</p>
          <div className="-mx-1 min-h-0 flex-1 overflow-auto px-1">
            {recent.map((g) => {
              const k = KIND[kindOf(g)]
              return (
                <a key={g.id} href={`#/guide/${g.id}${g.mode === 'video' && g.video ? '/video' : ''}`} onClick={onNavigate} className={`nav-item ${current === g.id ? 'active' : ''}`} title={g.title}>
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-md" style={{ background: `${k.color}14`, color: k.color }}>
                    <Icon name={k.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{g.title || 'Untitled guide'}</span>
                  {g.status === 'recording' && <span className="ml-auto h-2 w-2 flex-none animate-pulse rounded-full bg-rec" />}
                </a>
              )
            })}
          </div>
        </>
      )}
      {(collapsed || recent.length === 0) && <div className="flex-1" />}

      <div className="mt-3 space-y-1">
        <UpgradeCard collapsed={collapsed} />
        <button className={item()} onClick={openSettings} title="Settings">
          <Icon name="settings" className="h-[18px] w-[18px]" />
          {!collapsed && 'Settings'}
        </button>
        <a className={item()} href="https://www.stepcrumb.com/#faq" target="_blank" rel="noreferrer" title="Help">
          <Icon name="note" className="h-[18px] w-[18px]" />
          {!collapsed && 'Help'}
        </a>
      </div>
    </nav>
  )
}

export function AppShell({ current, children }: { current?: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => remembered('shell.collapsed') === '1')
  const [drawer, setDrawer] = useState(false)
  const [plans, setPlans] = useState(() => location.hash === '#/license')
  const [settings, setSettings] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  useEffect(() => {
    // The plans window replaces Settings if that's open, so it's never hidden behind it.
    const p = () => {
      setSettings(false)
      setPlans(true)
    }
    const s = () => setSettings(true)
    window.addEventListener('stepcrumb:plans', p)
    window.addEventListener('stepcrumb:settings', s)
    return () => {
      window.removeEventListener('stepcrumb:plans', p)
      window.removeEventListener('stepcrumb:settings', s)
    }
  }, [])
  useEffect(() => setDrawer(false), [current])
  const toggle = () => {
    setCollapsed((c) => {
      remember('shell.collapsed', c ? '0' : '1')
      return !c
    })
  }
  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen flex-none border-r border-line bg-side transition-[width] duration-200 lg:block ${collapsed ? 'w-[68px]' : 'w-64'}`}>
        <Sidebar collapsed={collapsed} onToggle={toggle} current={current} onToast={setToast} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)} style={{ background: 'rgb(21 20 18 / 0.35)' }}>
          <aside className="h-full w-72 border-r border-line bg-side shadow-float">
            <Sidebar collapsed={false} current={current} onNavigate={() => setDrawer(false)} onToast={setToast} />
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-line bg-side px-3 py-2 lg:hidden">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Icon name="list" />
          </button>
          <a href="#/" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span className="font-semibold">StepCrumb</span>
          </a>
        </div>
        {children}
      </div>
      {plans && (
        <PlansDialog
          onClose={() => {
            setPlans(false)
            if (location.hash === '#/license') location.hash = '#/'
          }}
        />
      )}
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
