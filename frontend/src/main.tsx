import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ProfessorDashboard from './professor/ProfessorDashboard.tsx'

const page =
  window.location.pathname.replace(/\/$/, '') === '/professor' ? (
    <ProfessorDashboard />
  ) : (
    <App />
  )

createRoot(document.getElementById('root')!).render(
  <StrictMode>{page}</StrictMode>,
)
