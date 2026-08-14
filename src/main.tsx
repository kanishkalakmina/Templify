import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { installDocumentFonts } from '@/render/documentFonts'
import './index.css'

// Non-Latin document scripts, so the canvas shows what the PDF will.
installDocumentFonts()

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root was not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
