import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Program from './pages/Program'
import Admin from './pages/Admin'
import Speaking from './pages/Speaking'
import Rehearsal from './pages/Rehearsal'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Preview-only staging route for the new/paid homepage split. Real
            users only ever hit "/", so this stays hidden from them. */}
        <Route path="/rehearsal" element={<Rehearsal />} />
        <Route path="/program" element={<Program />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/speaking" element={<Speaking />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
