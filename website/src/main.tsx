import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { Legal } from './Legal'
import { Thanks } from './Thanks'

const root = document.getElementById('root')!
const page = root.dataset.page as 'privacy' | 'terms' | 'thanks' | undefined

createRoot(root).render(<StrictMode>{page === 'thanks' ? <Thanks /> : page ? <Legal page={page} /> : <App />}</StrictMode>)
