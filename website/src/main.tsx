import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { Legal } from './Legal'

const root = document.getElementById('root')!
const page = root.dataset.page as 'privacy' | 'terms' | undefined

createRoot(root).render(<StrictMode>{page ? <Legal page={page} /> : <App />}</StrictMode>)
