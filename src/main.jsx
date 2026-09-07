import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './base.css'
import Studio from './Studio.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
)
