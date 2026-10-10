import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ProfessorDashboard from './professor/ProfessorDashboard.tsx'

const page = /^\/professor(?:\/|$)/.test(window.location.pathname) ? (
  <ProfessorDashboard />
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{page}</StrictMode>,
)
