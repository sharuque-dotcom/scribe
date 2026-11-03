import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Library } from './components/Library'
import { LicensePage } from './components/License'
import { Workspace, type Tab } from './components/Workspace'
import { applyHighlight } from '../shared/prefs'

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

function App() {
  const hash = useHash()
  const m = hash.match(/^#\/guide\/([^/]+)(?:\/(preview|sop|training|video))?$/)
  if (m) return <Workspace key={m[1]} id={m[1]} tab={(m[2] as Tab) ?? 'steps'} />
  if (hash === '#/license') return <LicensePage />
  return <Library />
}

// Highlights are drawn in the chosen colour, so load it before anything renders.
void applyHighlight().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
