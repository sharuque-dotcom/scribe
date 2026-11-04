import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { Legal } from './Legal'
import { Thanks } from './Thanks'
import { inject } from '@vercel/analytics'
import { CONFIG } from './config'

// Vercel Web Analytics: page views only, no cookies, nothing personal.
inject()

// Count clicks on "Add to Chrome" (just the click: no cookies, nothing personal).
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href]')
  if (a?.getAttribute('href') === CONFIG.chromeStoreUrl) navigator.sendBeacon?.('/api/count', new Blob([JSON.stringify({ e: 'install_click' })], { type: 'application/json' }))
})

const root = document.getElementById('root')!
const page = root.dataset.page as 'privacy' | 'terms' | 'thanks' | undefined

createRoot(root).render(<StrictMode>{page === 'thanks' ? <Thanks /> : page ? <Legal page={page} /> : <App />}</StrictMode>)
