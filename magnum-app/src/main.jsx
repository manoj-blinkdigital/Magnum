import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MagnumBeatBuilder from './magnum.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MagnumBeatBuilder />
  </StrictMode>,
)
